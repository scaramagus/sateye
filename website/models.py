from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils.timezone import make_naive

import pytz
from orbit_predictor import locations as op_locations

from website.utils import get_predictor_from_tle_lines


class Satellite(models.Model):
    """
    A specific satellite in orbit, that Sateye can display and track.
    """
    name = models.CharField(max_length=100)
    norad_id = models.IntegerField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True,
                              blank=True, related_name='satellites')

    def get_closest_tle(self, to_date):
        """
        Get the TLE that is closest to the specified date. If no TLE is found, then returns None.
        """
        closest_tle = None

        try:
            before = self.tles.filter(at__lte=to_date).order_by('at').last()
        except TLE.DoesNotExist as err:
            before = None

        try:
            after = self.tles.filter(at__gt=to_date).order_by('at').first()
        except TLE.DoesNotExist as err:
            after = None

        if before and not after:
            # only past tles found, return the newest one
            closest_tle = before
        elif after and not before:
            # only future tles found, return the oldest one
            closest_tle = after
        else:
            # past and future tles found, return the one that is closest
            diff_before = to_date - before
            diff_after = after - to_date

            if diff_before < diff_after:
                closest_tle = before
            else:
                closest_tle = after

        return closest_tle

    def get_predictor(self, for_date=None, precise=False):
        """
        Build an orbit predictor for the satellite, using its known TLEs.
        """
        assert self.tles.exists()
        if for_date:
            best_tle = self.get_closest_tle(for_date)
        else:
            best_tle = self.tles.order_by('at').last()

        return get_predictor_from_tle_lines(best_tle.lines.split('\n'), precise=precise)

    def predict_path(self, start_date, end_date, step_seconds=60):
        """
        Predict the positions of a satellite during a period of time, with certain step precision.
        """
        # get a predictor that is, on average, closest to the dates we will be using in this
        # period of time
        period_length = end_date - start_date
        period_center = start_date + period_length / 2
        predictor = self.get_predictor(for_date=period_center, precise=True)

        step = timedelta(seconds=step_seconds)

        # iterate over time, returning the position at each moment
        current_date = start_date
        while current_date <= end_date:
            # the predictor works with naive dates only
            naive_current_date = make_naive(current_date, pytz.utc)
            yield current_date, predictor.get_position(naive_current_date).position_llh
            current_date += step

    def predict_passes(self, location, start_date, end_date):
        """
        Predict the passes of a satellite over a location on TCA between two dates.
        """
        location = location.get_op_location()
        predictor = self.get_predictor(precise=True)

        for pass_ in predictor.passes_over(location, start_date):
            if pass_.los > end_date:
                break

            yield pass_

    @property
    def newest_tle(self):
        """
        Get the newest tle.
        """
        if self.tles.exists():
            return self.tles.order_by('at').last()

    def __str__(self):
        return self.name


class TLE(models.Model):
    """
    Orbital information from a specific satellite at a specific moment in time.
    """
    satellite = models.ForeignKey(Satellite, on_delete=models.CASCADE, related_name='tles')
    at = models.DateTimeField()
    lines = models.TextField()  # the actual two line element

    def __str__(self):
        return 'Recorded at {}'.format(self.at)


class UserActiveSatellite(models.Model):
    """
    A user is tracking this satellite in their map.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='active_satellites')
    satellite = models.ForeignKey(Satellite, on_delete=models.CASCADE,
                                  related_name='active_for_users')


class Location(models.Model):
    """
    A specific point location on Earth.
    """
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True,
                              blank=True, related_name='locations')
    name = models.CharField(max_length=100, null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    elevation = models.FloatField(null=True, blank=True)

    def get_op_location(self):
        """
        Build a orbit_predictor.locations.Location object from this model instance.
        """
        return op_locations.Location(self.name, self.latitude, self.longitude, self.elevation)

    def __str__(self):
        return '{} at ({}, {}) {} mts'.format(self.name, self.latitude, self.longitude,
                                              self.elevation)

# simulation/planets.py

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List

from .constants import CUSTOM_PLANET_DATA, ORBIT_DISTANCE_SCALE, REAL_PLANET_DATA, TIME_FLOW
from .models import PredictRequest
from .vector import Vec3

//행성을 화면에 표시하고 사용자와 상호작용하는 클래스
@dataclass
class Planet:
    name: str
    mass: float
    radius: float
    orbit_radius: float
    angular_speed: float
    initial_angle: float
    inclination: float
    ascending_node: float
    influence_radius: float
    color: int
    period_days: float = 0
    phase_at_epoch: float = 0
    mass_scale: float = 1
    radius_scale: float = 1

    @property
    def scaled_mass(self):
        return self.mass * self.mass_scale

    @property
    def scaled_radius(self):
        return self.radius * self.radius_scale

    @property
    def scaled_influence_radius(self):
        return self.influence_radius * math.sqrt(self.mass_scale)

    @property
    def visual_radius(self):
        if self.name == "Sun":
            return 32
        if self.name == "Jupiter":
            return 18
        if self.name == "Saturn":
            return 15
        if self.name == "Uranus":
            return 13
        if self.name == "Neptune":
            return 13
        if self.name == "Earth":
            return 12
        if self.name == "Venus":
            return 11
        if self.name == "Mars":
            return 10
        return 8

    @property
    def visual_scaled_radius(self):
        return self.visual_radius * self.radius_scale

    def rotate_axis(self, vector: Vec3, axis: Vec3, angle: float):
        axis = axis.normalize()
        c = math.cos(angle)
        s = math.sin(angle)

        return (
            vector.mul(c)
            .add(axis.cross(vector).mul(s))
            .add(axis.mul(axis.dot(vector) * (1 - c)))
        )

    def rotate_y(self, vector: Vec3, angle: float):
        c = math.cos(angle)
        s = math.sin(angle)

        return Vec3(
            vector.x * c + vector.z * s,
            vector.y,
            -vector.x * s + vector.z * c,
        )

    def orbit_transform_vector(self, vector: Vec3):
        node_axis = Vec3(
            math.cos(self.ascending_node),
            0,
            -math.sin(self.ascending_node),
        ).normalize()

        tilted = self.rotate_axis(vector, node_axis, self.inclination)
        return self.rotate_y(tilted, self.ascending_node)

    def position_at(self, t: float):
        if self.orbit_radius == 0:
            return Vec3(0, 0, 0)

        angle = self.angular_speed * t + self.initial_angle

        flat_position = Vec3(
            self.orbit_radius * math.cos(angle),
            0,
            self.orbit_radius * math.sin(angle),
        )

        return self.orbit_transform_vector(flat_position)


def days_from_j2000(date_string: str):
    selected = datetime.fromisoformat(date_string + "T12:00:00+00:00")
    j2000 = datetime(2000, 1, 1, 12, 0, 0, 0, tzinfo=timezone.utc)
    return (selected - j2000).total_seconds() / 86400


def make_planets(request: PredictRequest) -> List[Planet]:
    source = CUSTOM_PLANET_DATA if request.mode == "custom" else REAL_PLANET_DATA
    days = days_from_j2000(request.date)
    planets = []

    for item in source:
        data = dict(item)

        data["orbit_radius"] *= ORBIT_DISTANCE_SCALE
        data["inclination"] = math.radians(data.get("inclination", 0))
        data["ascending_node"] = math.radians(data.get("ascending_node", 0))

        if request.mode == "real" and data["orbit_radius"] != 0:
            angle_per_day = 2 * math.pi / data["period_days"]
            data["angular_speed"] = angle_per_day * TIME_FLOW
            data["initial_angle"] = data["phase_at_epoch"] + angle_per_day * days

        planet = Planet(**data)
        planet.mass_scale = request.mass_scales.get(planet.name, 1)
        planet.radius_scale = request.radius_scales.get(planet.name, 1)

        planets.append(planet)

    return planets

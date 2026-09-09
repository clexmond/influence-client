import { Quaternion, Vector3 } from 'three';

// Lift scales with surface travel, with a cap for trips around the far side.
const ARC_LIFT_PER_RADIAN = 0.5;
const MAX_ARC_LIFT = 0.75;

export function createLotCameraPath({ start, end, radius, stretch, rotationAxis, rotation, displacement }) {
  const from = start.clone();
  const to = end.clone();
  const direction = from.clone().normalize();
  const endDirection = to.clone().normalize();
  const turn = new Quaternion().setFromUnitVectors(direction, endDirection);
  const lift = radius * Math.min(MAX_ARC_LIFT, ARC_LIFT_PER_RADIAN * direction.angleTo(endDirection));
  const q = new Quaternion();
  const surfaceDirection = new Vector3();
  const surfaceHeight = (ray) => {
    surfaceDirection.copy(ray).applyAxisAngle(rotationAxis, -rotation).divide(stretch);
    return radius / surfaceDirection.length();
  };
  const startClearance = from.length() - surfaceHeight(direction);
  const endClearance = to.length() - surfaceHeight(endDirection);

  return (progress, position) => {
    if (progress <= 0) return position.copy(from);
    if (progress >= 1) return position.copy(to);
    const t = progress * progress * (3 - 2 * progress);
    q.identity().slerp(turn, t);
    position.copy(direction).applyQuaternion(q);
    const envelope = Math.sin(Math.PI * t);
    const height = Math.max(
      from.length() * (1 - t) + to.length() * t,
      surfaceHeight(position) + startClearance * (1 - t) + endClearance * t
    );
    // The broad crest provides terrain clearance and a view of the route;
    // exact endpoints retain the existing terrain-adjusted arrival altitude.
    return position.multiplyScalar(height + lift * (1 + displacement) * envelope);
  };
}

/**
 * How far a horizontally draggable rail can travel.
 *
 * The track starts after the container's left padding and should stop with its
 * last item clear of the right padding, so the travel is the track's scroll
 * width plus both paddings minus the container's full width. Anything that fits
 * has no travel (0) and the rail should not offer to be dragged.
 */
export function railTravel(trackScrollWidth: number, containerClientWidth: number, paddingLeft: number, paddingRight: number): number {
  const travel = trackScrollWidth + paddingLeft + paddingRight - containerClientWidth;
  return travel > 0.5 ? Math.ceil(travel) : 0;
}

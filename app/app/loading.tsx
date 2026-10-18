/**
 * Instant feedback while an /app screen loads. The root layout is force-dynamic,
 * so Links can only prefetch up to this boundary: with it, a sidebar click swaps
 * the content area at once instead of waiting on the server round trip.
 * The shell (sidebar, backdrop) stays mounted around it.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true" aria-label="Loading">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-lime" />
    </div>
  );
}

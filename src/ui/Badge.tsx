export type Provenance = 'reported' | 'measured' | 'watch-estimated' | 'computed' | 'proposed' | 'watch-export';

const HELP: Record<Provenance, string> = {
  reported: 'Entered by you',
  measured: 'Recorded by the watch or device',
  'watch-estimated': 'Estimated by the watch from its sensors',
  computed: 'Calculated by this app from other values',
  proposed: 'A suggestion you can accept or ignore',
  'watch-export': 'Taken from the activity file exported from your watch',
};

/** Text label (not colour alone) saying where a figure came from. */
export function Badge({ kind }: { kind: Provenance }) {
  return <span className={`badge badge-${kind}`} title={HELP[kind]}>{kind === 'watch-export' ? 'watch export' : kind}</span>;
}

import type { ScreenRoute } from '../app/routes';

const ACCESS_LABEL: Record<ScreenRoute['access'], string> = {
  guest: 'Guest',
  collector: 'Collector',
  store_manager: 'Store Manager',
};

export default function PlaceholderScreen({ screen }: { screen: ScreenRoute }) {
  return (
    <section>
      <h1>{screen.title}</h1>
      <p className="muted">
        <code>{screen.path}</code> · {ACCESS_LABEL[screen.access]}
        {screen.stories.length > 0 && ` · ${screen.stories.join(', ')}`}
      </p>
      <p className="muted">Placeholder — built in a later task (see docs/TASKS.md).</p>
    </section>
  );
}

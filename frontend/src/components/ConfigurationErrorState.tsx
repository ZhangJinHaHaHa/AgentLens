interface ConfigurationErrorStateProps {
  error: string;
}

export function ConfigurationErrorState({
  error
}: ConfigurationErrorStateProps): JSX.Element {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Frontend configuration</p>
        <h1>Configuration required</h1>
        <p className="intro">
          Set the required `VITE_AUDIT_*` variables before using the read-only registry view.
        </p>
        <p role="alert">{error}</p>
      </section>
    </main>
  );
}

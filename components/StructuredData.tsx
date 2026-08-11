/**
 * Renders a JSON-LD block for search engines.
 *
 * Server component on purpose: the markup has to exist in the initial HTML
 * response, because crawlers read structured data before running any script.
 */
export default function StructuredData({ id, data }: { id: string; data: Record<string, unknown> }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      // The payload is authored in this repository, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

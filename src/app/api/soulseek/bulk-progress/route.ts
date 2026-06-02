import { eventBus } from "@/lib/event-bus";
import { getBulkState } from "@/lib/bulk-downloader";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const state = getBulkState();
      if (state?.running) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "progress", searched: state.searched, queued: state.queued,
          noResults: state.noResults, total: state.total,
        })}\n\n`));
      }

      const emit = (type: string) => (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...(data as object) })}\n\n`));
      };

      const onSearching = emit("searching");
      const onQueued = emit("queued");
      const onNoResults = emit("no_results");
      const onProgress = emit("progress");
      const onDone = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", ...(data as object) })}\n\n`));
        cleanup();
        controller.close();
      };

      const cleanup = () => {
        eventBus.off("bulk:searching", onSearching);
        eventBus.off("bulk:queued", onQueued);
        eventBus.off("bulk:no_results", onNoResults);
        eventBus.off("bulk:progress", onProgress);
        eventBus.off("bulk:done", onDone);
      };

      eventBus.on("bulk:searching", onSearching);
      eventBus.on("bulk:queued", onQueued);
      eventBus.on("bulk:no_results", onNoResults);
      eventBus.on("bulk:progress", onProgress);
      eventBus.on("bulk:done", onDone);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

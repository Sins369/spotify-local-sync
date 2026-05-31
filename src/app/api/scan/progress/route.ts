import { eventBus } from "@/lib/event-bus";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const onProgress = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const onComplete = (data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ ...(data as object), done: true })}\n\n`
          )
        );
        cleanup();
        controller.close();
      };
      const cleanup = () => {
        eventBus.off("scan:progress", onProgress);
        eventBus.off("scan:complete", onComplete);
      };
      eventBus.on("scan:progress", onProgress);
      eventBus.on("scan:complete", onComplete);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

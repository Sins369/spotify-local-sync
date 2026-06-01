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
      const onError = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const cleanup = () => {
        eventBus.off("backup:progress", onProgress);
        eventBus.off("backup:complete", onComplete);
        eventBus.off("backup:error", onError);
      };
      eventBus.on("backup:progress", onProgress);
      eventBus.on("backup:complete", onComplete);
      eventBus.on("backup:error", onError);
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

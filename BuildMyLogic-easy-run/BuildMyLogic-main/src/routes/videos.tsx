import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CameraVideo } from "@/components/CameraVideo";

export const Route = createFileRoute("/videos")({
  head: () => ({ meta: [{ title: "Videos — BuildMyLogic" }] }),
  component: Videos,
});

// Python for Beginners - Full Course (freeCodeCamp.org on YouTube)
const VIDEO_ID = "rfscVS0vtbw";

function Videos() {
  return (
    <AppShell
      crumb="Learn"
      title="Python video"
      subtitle="Watch with your camera on. The video waits for you."
      wide
    >
      <div className="mx-auto w-full max-w-3xl p-3 sm:p-5">
        <CameraVideo
          videoId={VIDEO_ID}
          title="Python for Beginners - Full Course"
        />
      </div>
    </AppShell>
  );
}

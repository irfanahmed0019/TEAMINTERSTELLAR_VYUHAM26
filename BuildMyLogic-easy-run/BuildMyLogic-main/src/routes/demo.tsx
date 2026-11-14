import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { enterPublicDemo } from "@/lib/demo-mode";
export const Route = createFileRoute("/demo")({ component: DemoEntry });
function DemoEntry() {
  useEffect(() => enterPublicDemo(), []);
  return <p>Opening demo in BuildMyLogic...</p>;
}

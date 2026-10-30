import { Link } from "@tanstack/react-router";

export function LegalLinks() {
  return (
    <p className="mt-auto px-4 pb-8 pt-4 text-center text-xs text-muted-foreground">
      <Link to="/privacy" className="underline-offset-2 hover:underline">
        Privacy Policy
      </Link>
      <span aria-hidden="true"> · </span>
      <Link to="/terms" className="underline-offset-2 hover:underline">
        Terms of Use
      </Link>
    </p>
  );
}

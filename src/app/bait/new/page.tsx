import { BaitSpotForm } from "@/components/BaitSpotForm";

export default function NewBaitSpotPage() {
  return (
    <div className="space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal">Log bait</h1>
        <p className="text-sm text-ink-muted">
          Where you get bait — shrimp, mullet, crabs — not necessarily where you land fish. Pin
          the hole, name the area, tag the bait. Weather fills in from the pin.
        </p>
      </div>
      <BaitSpotForm mode="create" />
    </div>
  );
}

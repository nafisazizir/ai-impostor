import { DotMatrixLoader } from "@/components/ui/dot-matrix-loader";

export default function HistoryLoading() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <DotMatrixLoader />
    </div>
  );
}

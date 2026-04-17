import { useState } from "react";
import { FiChevronUp, FiX } from "react-icons/fi";

function BottomDrawer({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-slate-950/40 ring-1 ring-white/20 transition hover:bg-slate-900"
      >
        Plan route
        <FiChevronUp className="h-4 w-4" />
      </button>

      {isOpen ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-40 w-full h-[90vh] overflow-hidden rounded-t-3xl bg-white/95 shadow-2xl shadow-slate-950/20 outline-none backdrop-blur-xl">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-200" />
            <div className="relative flex h-full flex-col">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              >
                <FiX className="h-5 w-5" />
              </button>
              <div
                className="flex-1 min-h-0 overflow-y-auto pr-1"
                style={{
                  WebkitOverflowScrolling: "touch",
                  touchAction: "pan-y",
                }}
              >
                <div className="space-y-4 pt-2 pb-6">{children}</div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export default BottomDrawer;

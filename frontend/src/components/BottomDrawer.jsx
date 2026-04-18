import { useRef, useState } from "react";
import { FiChevronUp, FiMove, FiX } from "react-icons/fi";

function BottomDrawer({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(90);
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const dragState = useRef({ active: false, startY: 0, startHeight: 90 });
  const sidebarDragState = useRef({
    active: false,
    startX: 0,
    startWidth: 420,
  });

  function handleSheetDragStart(event) {
    if (!event.isPrimary) return;
    dragState.current = {
      active: true,
      startY: event.clientY,
      startHeight: sheetHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSheetDragMove(event) {
    if (!dragState.current.active) return;
    const deltaY = event.clientY - dragState.current.startY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    const nextHeight = dragState.current.startHeight - deltaVh;
    setSheetHeight(Math.min(90, Math.max(40, nextHeight)));
  }

  function handleSheetDragEnd(event) {
    dragState.current.active = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore pointer release errors
    }
  }

  function handleSidebarDragStart(event) {
    if (!event.isPrimary) return;
    sidebarDragState.current = {
      active: true,
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSidebarDragMove(event) {
    if (!sidebarDragState.current.active) return;
    const deltaX = sidebarDragState.current.startX - event.clientX;
    const nextWidth = sidebarDragState.current.startWidth + deltaX;
    const maxWidth = Math.min(720, window.innerWidth - 200);
    setSidebarWidth(Math.min(maxWidth, Math.max(420, nextWidth)));
  }

  function handleSidebarDragEnd(event) {
    sidebarDragState.current.active = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore pointer release errors
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-slate-950/40 ring-1 ring-white/20 transition hover:bg-slate-900 md:hidden"
      >
        Plan route
        <FiChevronUp className="h-4 w-4" />
      </button>

      <div
        className="hidden md:block md:fixed md:inset-y-0 md:right-0 md:z-40 md:border-l md:border-slate-200 md:bg-white/95 md:shadow-2xl md:shadow-slate-950/20 md:backdrop-blur-xl"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div
          className="absolute z-10 left-0 top-0 h-full w-6 cursor-ew-resize bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
          onPointerDown={handleSidebarDragStart}
          onPointerMove={handleSidebarDragMove}
          onPointerUp={handleSidebarDragEnd}
          style={{ touchAction: "none" }}
        >
          <FiMove className="h-4 w-4 text-slate-500" />
        </div>
        <div className="mx-auto mt-4 mb-4 h-1.5 w-16 rounded-full bg-slate-200/70" />
        <div className="relative flex h-full flex-col overflow-hidden p-6">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-4">{children}</div>
          </div>
        </div>
      </div>

      {isOpen ? (
        <>
          {/* // Backdrop to close the drawer when clicking outside of it */}
          <div
            className="fixed inset-0 z-30 bg-slate-950/30 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 w-full overflow-hidden rounded-t-3xl bg-white/95 shadow-2xl shadow-slate-950/20 outline-none backdrop-blur-xl md:hidden"
            style={{ height: `${sheetHeight}vh` }}
          >
            <div className="mx-auto mb-4 flex items-center justify-center">
              <div
                className="flex h-10 w-20 items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 cursor-row-resize"
                onPointerDown={handleSheetDragStart}
                onPointerMove={handleSheetDragMove}
                onPointerUp={handleSheetDragEnd}
                style={{ touchAction: "none" }}
              >
                <FiMove className="h-5 w-5 text-slate-600" />
              </div>
            </div>
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

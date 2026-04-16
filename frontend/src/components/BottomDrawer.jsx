import { Drawer } from "vaul";

function BottomDrawer() {
  return (
    <Drawer.Root>
      <Drawer.Trigger>Open Drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="z-2 bg-gray-100 h-fit fixed bottom-0 left-0 right-0 outline-none">
          <div className="p-4 bg-white">
            {/* Content */}
            heelo
          </div>
          <Drawer.Handle />
          <Drawer.Title />
          <Drawer.Description />
          <Drawer.Close />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export default BottomDrawer;

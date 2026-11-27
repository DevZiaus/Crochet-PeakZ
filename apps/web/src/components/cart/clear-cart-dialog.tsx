"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Props for {@link ClearCartDialog}. */
export interface ClearCartDialogProps {
  /** Whether the confirm dialog is open. */
  open: boolean;
  /** Called when the dialog requests open state change. */
  onOpenChange: (open: boolean) => void;
  /** True while clearing is in flight. */
  clearing: boolean;
  /** Called when the shopper confirms clearing the cart. */
  onConfirm: () => Promise<void>;
}

/**
 * Confirmation dialog guarding the `/cart` `Clear cart` action (AC-15).
 */
export function ClearCartDialog({
  open,
  onOpenChange,
  clearing,
  onConfirm,
}: ClearCartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-foreground">
            Remove all items from your cart?
          </DialogTitle>
          <DialogDescription>
            Every item currently in your shopping cart will be removed. You can
            always add pieces again from the shop.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={clearing}
            onClick={() => {
              onOpenChange(false);
            }}
            className="min-h-[44px]"
          >
            Keep items
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={clearing}
            onClick={() => {
              void onConfirm();
            }}
            className="min-h-[44px]"
          >
            {clearing ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            Clear cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { ReactNode } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UpgradeToProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: ReactNode;
}

export function UpgradeToProModal({ open, onOpenChange, reason }: UpgradeToProModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upgrade to Pro
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-4">
            <p>{reason || 'Upgrade to unlock this feature.'}</p>
            <p>
              Pro includes unlimited history, more platforms per request, higher blog limits, and Brand Voice support.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
          <AlertDialogCancel className="w-full sm:w-auto">Close</AlertDialogCancel>
          <AlertDialogAction asChild className="w-full sm:w-auto">
            <Link to="/account#promo">Enter Promo Code</Link>
          </AlertDialogAction>
          <AlertDialogAction asChild className="w-full sm:w-auto">
            <Link to="/account">Go to Account Page</Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessDenied() {
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setErrorMessage(decodeURIComponent(error));
    } else {
      setErrorMessage("You do not have permission to access this application.");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" data-testid="icon-alert" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-title">Access Denied</CardTitle>
          <CardDescription data-testid="text-error-message">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground text-center">
            If you believe this is an error, please contact your system administrator for assistance.
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/auth"}
            className="w-full"
            data-testid="button-try-again"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

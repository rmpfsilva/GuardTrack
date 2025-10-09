import { Shield, Clock, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">GuardTrack</span>
          </div>
          <Button 
            onClick={() => window.location.href = '/auth'}
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Professional Security Guard
              <span className="text-primary block mt-2">Shift Management</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Streamline guard check-ins, track attendance, and manage shifts with real-time monitoring and automated reporting.
            </p>
            <Button 
              size="lg"
              onClick={() => window.location.href = '/auth'}
              className="h-12 px-8 text-lg"
              data-testid="button-get-started"
            >
              Get Started
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need for Security Operations
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            <Card className="p-6">
              <Clock className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Quick Check-In</h3>
              <p className="text-muted-foreground text-sm">
                Guards can check in and out instantly from any device with timestamp and location tracking.
              </p>
            </Card>
            
            <Card className="p-6">
              <Users className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Site Management</h3>
              <p className="text-muted-foreground text-sm">
                Add and manage multiple security sites with detailed location information.
              </p>
            </Card>
            
            <Card className="p-6">
              <BarChart3 className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Hours Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Automatic calculation of weekly hours per employee with detailed shift history.
              </p>
            </Card>
            
            <Card className="p-6">
              <Shield className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Admin Dashboard</h3>
              <p className="text-muted-foreground text-sm">
                Real-time monitoring of all guards, sites, and shift activities from one central dashboard.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto p-12 text-center bg-primary text-primary-foreground">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Transform Your Security Operations?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Join security companies that trust GuardTrack for reliable shift management.
            </p>
            <Button 
              size="lg"
              variant="secondary"
              onClick={() => window.location.href = '/auth'}
              className="h-12 px-8 text-lg"
              data-testid="button-cta-login"
            >
              Sign In Now
            </Button>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 GuardTrack. Professional Security Shift Management.</p>
        </div>
      </footer>
    </div>
  );
}

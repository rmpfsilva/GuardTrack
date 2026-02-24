import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Users, Clock, DollarSign, BookOpen, Mail } from "lucide-react";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen guardtrack-bg">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <img 
                src={guardTrackLogo} 
                alt="GuardTrack" 
                className="h-12 w-auto"
                data-testid="img-logo-header"
              />
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm text-foreground/80 hover:text-foreground transition-colors" data-testid="link-how-it-works">
                How It Works
              </a>
              <a href="#about" className="text-sm text-foreground/80 hover:text-foreground transition-colors" data-testid="link-about">
                About Us
              </a>
              <a href="#who-uses" className="text-sm text-foreground/80 hover:text-foreground transition-colors" data-testid="link-who-uses">
                Who Uses It
              </a>
              <a href="#pricing" className="text-sm text-foreground/80 hover:text-foreground transition-colors" data-testid="link-pricing">
                Pricing
              </a>
              <a href="#learn" className="text-sm text-foreground/80 hover:text-foreground transition-colors" data-testid="link-learn">
                Learn
              </a>
              <a href="#contact" className="text-sm text-foreground/80 hover:text-foreground transition-colors" data-testid="link-contact">
                Contact
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" data-testid="button-nav-login">Login</Button>
              </Link>
              <Link href="/login">
                <Button data-testid="button-nav-signup">Sign Up</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-5xl mx-auto text-center space-y-10">
            <div className="flex justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
              </div>
              <img 
                src={guardTrackLogo} 
                alt="GuardTrack" 
                className="w-72 h-auto relative"
                data-testid="img-logo-hero"
              />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Security Guard Management Made Simple
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Track shifts, manage attendance, and streamline security operations with GuardTrack.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/login">
                <Button size="lg" className="text-base px-8" data-testid="button-hero-get-started">Get Started</Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="text-base px-8 bg-background/20 backdrop-blur-sm" data-testid="button-hero-learn-more">Learn More</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="hover-elevate">
                <CardHeader>
                  <Clock className="h-10 w-10 text-primary mb-3" />
                  <CardTitle>1. Schedule Shifts</CardTitle>
                  <CardDescription>
                    Admins create and assign shifts to security guards through an intuitive calendar interface.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover-elevate">
                <CardHeader>
                  <ShieldCheck className="h-10 w-10 text-primary mb-3" />
                  <CardTitle>2. Check In/Out</CardTitle>
                  <CardDescription>
                    Guards check in and out with GPS verification, ensuring accurate location tracking and attendance.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover-elevate">
                <CardHeader>
                  <DollarSign className="h-10 w-10 text-primary mb-3" />
                  <CardTitle>3. Generate Reports</CardTitle>
                  <CardDescription>
                    Automatic billing reports based on hours worked, with export to Google Sheets and professional invoices.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10">About Us</h2>
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <p className="text-muted-foreground text-lg leading-relaxed">
                GuardTrack was born from a real need in the security industry. We saw security companies struggling with 
                outdated attendance systems, manual timesheet calculations, and complex billing processes. Our mission 
                is to provide a modern, efficient solution that saves time and reduces administrative overhead.
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Built by a team passionate about combining technology with operational efficiency, GuardTrack has grown 
                to serve security companies of all sizes, helping them manage their workforce with confidence and precision.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="who-uses" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-16">Who Uses GuardTrack?</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="hover-elevate">
                <CardHeader>
                  <Users className="h-10 w-10 text-primary mb-3" />
                  <CardTitle>Security Companies</CardTitle>
                  <CardDescription>
                    Perfect for security firms managing multiple sites and guards. Streamline operations, reduce 
                    paperwork, and improve accuracy in billing and reporting.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover-elevate">
                <CardHeader>
                  <ShieldCheck className="h-10 w-10 text-primary mb-3" />
                  <CardTitle>Event Security Teams</CardTitle>
                  <CardDescription>
                    Ideal for event security management with flexible shift scheduling, real-time attendance tracking, 
                    and quick overtime approvals for dynamic event environments.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-10">Pricing</h2>
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Contact Us for Pricing</CardTitle>
                <CardDescription>
                  We offer flexible pricing plans tailored to your organization's size and needs. 
                  Get in touch to discuss the best solution for your security operations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a href="#contact">
                  <Button className="w-full" data-testid="button-pricing-contact">Get a Quote</Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="learn" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-16">How to Use GuardTrack</h2>
            <div className="space-y-6">
              <Card className="hover-elevate">
                <CardHeader>
                  <BookOpen className="h-8 w-8 text-primary mb-3" />
                  <CardTitle>For Administrators</CardTitle>
                  <CardDescription>
                    Set up sites and rates, schedule shifts, monitor real-time attendance, approve breaks and overtime, 
                    and generate comprehensive billing reports and invoices.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover-elevate">
                <CardHeader>
                  <BookOpen className="h-8 w-8 text-primary mb-3" />
                  <CardTitle>For Security Guards</CardTitle>
                  <CardDescription>
                    View your schedule, check in/out with GPS verification, track breaks, apply for available shifts, 
                    and receive instant notifications about new opportunities.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-10">Contact Us</h2>
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <Mail className="h-12 w-12 text-primary mx-auto mb-3" />
                <CardTitle>Get in Touch</CardTitle>
                <CardDescription>
                  Have questions? Want to schedule a demo? We'd love to hear from you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Contact information coming soon. We're setting up our support channels to better serve you.
                </p>
                <Link href="/login">
                  <Button className="w-full" data-testid="button-contact-get-started">Get Started Now</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="py-10 border-t border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <img 
                src={guardTrackLogo} 
                alt="GuardTrack" 
                className="h-8 w-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} GuardTrack. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

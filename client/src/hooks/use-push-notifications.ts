import { useState, useEffect } from "react";
import { useAuth } from "./use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "./use-toast";

// VAPID public key - needs to be generated and stored in environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 
                     'PushManager' in window && 
                     'Notification' in window;
    setIsSupported(supported);
    
    if (supported && Notification.permission) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check existing subscription
  useEffect(() => {
    if (!isSupported || !user) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  const requestPermission = async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser",
        variant: "destructive",
      });
      return false;
    }

    if (permission === "granted") {
      return true;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        return true;
      } else if (result === "denied") {
        toast({
          title: "Permission Denied",
          description: "You have blocked notifications. Enable them in your browser settings.",
          variant: "destructive",
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast({
        title: "Error",
        description: "Failed to request notification permission",
        variant: "destructive",
      });
      return false;
    }
  };

  const subscribe = async () => {
    if (!isSupported || !user) return;
    
    setIsLoading(true);
    
    try {
      // Check if VAPID key is configured
      if (!VAPID_PUBLIC_KEY) {
        toast({
          title: "Configuration Error",
          description: "Push notifications are not configured on this server. Please contact your administrator.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Request permission first
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      if (subscription) {
        // Send subscription to backend
        await apiRequest("POST", "/api/push-subscriptions", {
          endpoint: subscription.endpoint,
          keys: JSON.stringify({
            p256dh: subscription.toJSON().keys?.p256dh || "",
            auth: subscription.toJSON().keys?.auth || "",
          }),
        });

        setIsSubscribed(true);
        toast({
          title: "Success",
          description: "You will now receive notifications for new opportunities!",
        });
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: "Subscription Failed",
        description: error instanceof Error ? error.message : "Failed to subscribe to notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!isSupported || !user) return;
    
    setIsLoading(true);
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Remove subscription from backend first
        const endpoint = subscription.endpoint;
        try {
          // Delete from backend - backend will find and delete by endpoint
          await apiRequest("DELETE", "/api/push-subscriptions", { endpoint });
        } catch (backendError) {
          console.error('Error removing subscription from backend:', backendError);
          // Continue with local unsubscribe even if backend fails
        }

        // Unsubscribe locally
        await subscription.unsubscribe();
        
        setIsSubscribed(false);
        toast({
          title: "Unsubscribed",
          description: "You will no longer receive push notifications",
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: "Error",
        description: "Failed to unsubscribe from notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    permission,
    isSubscribed,
    isLoading,
    isSupported,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}

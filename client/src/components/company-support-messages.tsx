import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail, Send } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SupportMessage } from "@shared/schema";

interface MessageWithDetails extends SupportMessage {
  senderName?: string;
  companyName?: string;
}

export default function CompanySupportMessages() {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");

  const { data: messages = [], isLoading } = useQuery<MessageWithDetails[]>({
    queryKey: ['/api/support/company'],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest('POST', '/api/support/send', { message });
    },
    onSuccess: () => {
      toast({
        title: "Message sent",
        description: "Your message has been sent to support. We'll get back to you soon.",
      });
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/support/company'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }
    sendMessageMutation.mutate(newMessage);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading messages...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Support Messages
              </CardTitle>
              <CardDescription>
                Your conversation with support
              </CardDescription>
            </div>
            {messages.length > 0 && (
              <Badge variant="secondary" data-testid="badge-message-count">
                {messages.length} messages
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px] pr-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground">No messages yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Send a message below to contact support
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isAdminReply ? 'justify-start' : 'justify-end'}`}
                    data-testid={`message-${message.id}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        message.isAdminReply
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {message.isAdminReply ? (
                          <Badge variant="outline" className="text-xs bg-primary-foreground text-primary">
                            Support Team
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                        <span className="text-xs opacity-70">
                          {message.createdAt && format(new Date(message.createdAt), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            <CardTitle>Contact Support</CardTitle>
          </div>
          <CardDescription>
            Need help? Send a message to our support team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Type your message or question here..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[120px]"
            data-testid="textarea-support-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={sendMessageMutation.isPending || !newMessage.trim()}
            className="w-full"
            data-testid="button-send-support"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

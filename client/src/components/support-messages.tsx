import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Send, MessageSquare, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SupportMessage } from "@shared/schema";

interface MessageWithDetails extends SupportMessage {
  senderName?: string;
  companyName?: string;
}

export default function SupportMessages() {
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");

  // Fetch all support messages
  const { data: messages = [], isLoading } = useQuery<MessageWithDetails[]>({
    queryKey: ['/api/support/messages'],
  });

  // Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (data: { message: string; companyId: string }) => {
      return await apiRequest('/api/support/send', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/messages'] });
      setReplyMessage("");
      toast({
        title: "Reply sent",
        description: "Your message has been sent to the customer",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reply",
        variant: "destructive",
      });
    },
  });

  // Mark message as read
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest(`/api/support/messages/${messageId}/read`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/messages'] });
    },
  });

  // Group messages by company
  const messagesByCompany = messages.reduce((acc, message) => {
    if (!acc[message.companyId]) {
      acc[message.companyId] = [];
    }
    acc[message.companyId].push(message);
    return acc;
  }, {} as Record<string, MessageWithDetails[]>);

  const selectedMessages = selectedCompanyId ? messagesByCompany[selectedCompanyId] || [] : [];
  const unreadCount = messages.filter(m => !m.isRead && !m.isAdminReply).length;

  const handleSendReply = () => {
    if (!selectedCompanyId || !replyMessage.trim()) return;
    
    sendReplyMutation.mutate({
      message: replyMessage,
      companyId: selectedCompanyId,
    });
  };

  const handleSelectConversation = (companyId: string) => {
    setSelectedCompanyId(companyId);
    // Mark all unread messages from this company as read
    const unreadMessages = messagesByCompany[companyId]?.filter(m => !m.isRead && !m.isAdminReply);
    unreadMessages?.forEach(msg => {
      if (!msg.isRead) {
        markAsReadMutation.mutate(msg.id);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Customer Support Messages</h2>
          <p className="text-muted-foreground">View and respond to customer inquiries</p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" data-testid="badge-unread-count">
            {unreadCount} Unread
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        {/* Conversations List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {Object.entries(messagesByCompany).length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {Object.entries(messagesByCompany).map(([companyId, msgs]) => {
                    const latestMessage = msgs[0];
                    const unreadInConversation = msgs.filter(m => !m.isRead && !m.isAdminReply).length;
                    
                    return (
                      <button
                        key={companyId}
                        onClick={() => handleSelectConversation(companyId)}
                        className={`w-full text-left p-3 rounded-md transition-colors hover-elevate ${
                          selectedCompanyId === companyId ? 'bg-accent' : ''
                        }`}
                        data-testid={`button-conversation-${companyId}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {latestMessage.companyName || 'Unknown Company'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {latestMessage.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(latestMessage.createdAt), 'MMM dd, HH:mm')}
                            </p>
                          </div>
                          {unreadInConversation > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {unreadInConversation}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages View */}
        <Card className="md:col-span-2">
          {selectedCompanyId ? (
            <>
              <CardHeader>
                <CardTitle className="text-sm">
                  {selectedMessages[0]?.companyName || 'Conversation'}
                </CardTitle>
                <CardDescription>{selectedMessages.length} messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-4">
                    {selectedMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isAdminReply ? 'justify-end' : 'justify-start'}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.isAdminReply
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {message.isAdminReply ? (
                              <Badge variant="outline" className="text-xs">Admin</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Customer</Badge>
                            )}
                            <span className="text-xs opacity-70">
                              {format(new Date(message.createdAt), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Reply Box */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="textarea-reply"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyMessage.trim() || sendReplyMutation.isPending}
                      data-testid="button-send-reply"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading messages...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

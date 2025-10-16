import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail } from "lucide-react";
import { format } from "date-fns";
import type { SupportMessage } from "@shared/schema";

interface MessageWithDetails extends SupportMessage {
  senderName?: string;
  companyName?: string;
}

export default function CompanySupportMessages() {
  // Fetch company's support messages
  const { data: messages = [], isLoading } = useQuery<MessageWithDetails[]>({
    queryKey: ['/api/support/company'],
  });

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
        <ScrollArea className="h-[400px] pr-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Use the Contact Support form below to send a message
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
                        {format(new Date(message.createdAt), 'MMM dd, HH:mm')}
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
  );
}

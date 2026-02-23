import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { MessageCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface JobShareMessagesProps {
  jobShareId: string;
  isExpanded?: boolean;
}

interface MessageData {
  id: string;
  jobShareId: string;
  senderCompanyId: string;
  senderUserId: string;
  message: string;
  createdAt: string;
  senderCompanyName: string;
  senderUserName: string;
  senderFirstName: string | null;
  senderLastName: string | null;
}

export function JobShareMessages({ jobShareId, isExpanded: initialExpanded = false }: JobShareMessagesProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [newMessage, setNewMessage] = useState("");

  const { data: messages = [] } = useQuery<MessageData[]>({
    queryKey: ['/api/job-shares', jobShareId, 'messages'],
    queryFn: async () => {
      const res = await fetch(`/api/job-shares/${jobShareId}/messages`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    refetchInterval: isExpanded ? 15000 : false,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest('POST', `/api/job-shares/${jobShareId}/messages`, { message });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares', jobShareId, 'messages'] });
    },
  });

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSenderName = (msg: MessageData) => {
    if (msg.senderFirstName && msg.senderLastName) {
      return `${msg.senderFirstName} ${msg.senderLastName}`;
    }
    return msg.senderUserName || 'Unknown';
  };

  const lastReadKey = `jobshare_messages_read_${jobShareId}_${user?.id}`;
  const lastRead = parseInt(localStorage.getItem(lastReadKey) || '0', 10);
  const unreadCount = messages.filter(m =>
    m.senderCompanyId !== user?.companyId &&
    new Date(m.createdAt).getTime() > lastRead
  ).length;

  const handleToggle = () => {
    if (!isExpanded) {
      localStorage.setItem(lastReadKey, Date.now().toString());
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="border-t pt-2" data-testid={`messages-section-${jobShareId}`}>
      <button
        onClick={handleToggle}
        className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        data-testid={`button-toggle-messages-${jobShareId}`}
      >
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4" />
          Messages ({messages.length})
          {unreadCount > 0 && !isExpanded && (
            <Badge variant="destructive" className="text-[10px] leading-none px-1.5 py-0.5">
              {unreadCount}
            </Badge>
          )}
        </span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">No messages yet. Start a conversation.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {messages.map(msg => {
                const isOwnCompany = msg.senderCompanyId === user?.companyId;
                return (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-md text-sm ${isOwnCompany ? 'bg-primary/5 ml-4' : 'bg-muted/60 mr-4'}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-medium">
                        {getSenderName(msg)} ({msg.senderCompanyName})
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(msg.createdAt), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm"
              data-testid={`input-message-${jobShareId}`}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMutation.isPending}
              data-testid={`button-send-message-${jobShareId}`}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function useUnreadMessageCount(jobShareId: string, userId?: string) {
  const lastReadKey = `jobshare_messages_read_${jobShareId}_${userId}`;
  const lastRead = parseInt(localStorage.getItem(lastReadKey) || '0', 10);

  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ['/api/job-shares', jobShareId, 'messages'],
    queryFn: async () => {
      const res = await fetch(`/api/job-shares/${jobShareId}/messages`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobShareId && !!userId,
  });

  return messages.filter(m =>
    m.senderCompanyId !== undefined &&
    new Date(m.createdAt).getTime() > lastRead
  ).length;
}

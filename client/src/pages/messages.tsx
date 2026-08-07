import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatInAppTz } from '@/lib/timezone';
import { Message, User } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { Send, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useGuestRestriction } from '@/hooks/use-guest-restriction';

const Messages = () => {
  const { user } = useAuth();
  const { isGuest, blockAction } = useGuestRestriction();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isCoach, setIsCoach] = useState(false);

  // Fetch user messages
  const { data: messages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ['/api/messages', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      
      // For coaches, fetch messages between coach and the selected user
      // For regular users, fetch messages between user and the selected coach
      const response = await fetch(`/api/messages?userId=${selectedUserId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!selectedUserId && !isGuest
  });

  // Fetch users (for coach) - coaches can message their clients
  const { data: clients, isLoading: isLoadingClients } = useQuery<User[]>({
    queryKey: ['/api/users', { coachId: user?.id }],
    enabled: isCoach && !isGuest
  });

  // Fetch coaches (for regular users) - users can only message coaches
  const { data: coaches } = useQuery<User[]>({
    queryKey: ['/api/users', { role: 'coach' }],
    enabled: !isCoach && !isGuest
  });

  // Mark messages as read mutation
  const markMessagesAsRead = useMutation({
    mutationFn: async (messageIds: number[]) => {
      for (const messageId of messageIds) {
        await apiRequest('PATCH', `/api/messages/${messageId}/read`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
    onError: (error) => {
      console.error('Failed to mark messages as read:', error);
    }
  });

  // Set up mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', '/api/messages', {
        receiverId: selectedUserId,
        content
      });
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
      console.error('Error sending message:', error);
    }
  });

  // Determine if user is a coach
  useEffect(() => {
    if (user) {
      setIsCoach(user.role === 'coach');
    }
  }, [user]);

  // Select first user/coach if none selected
  useEffect(() => {
    if (!selectedUserId) {
      if (isCoach && clients && clients.length > 0) {
        setSelectedUserId(clients[0].id);
      } else if (!isCoach && coaches && coaches.length > 0) {
        setSelectedUserId(coaches[0].id);
      }
    }
  }, [isCoach, clients, coaches, selectedUserId]);

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (messages && selectedUserId && user) {
      const unreadMessages = messages.filter(msg => !msg.read && msg.receiverId === user.id);
      if (unreadMessages.length > 0) {
        const unreadMessageIds = unreadMessages.map(msg => msg.id);
        markMessagesAsRead.mutate(unreadMessageIds);
      }
    }
  }, [messages, selectedUserId, user?.id]);

  const handleSendMessage = () => {
    if (isGuest) {
      blockAction();
      return;
    }

    if (!message.trim() || !selectedUserId) return;
    sendMessageMutation.mutate(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getOtherUser = (userId: number): User | undefined => {
    if (isCoach) {
      return clients?.find(c => c.id === userId);
    } else {
      return coaches?.find(c => c.id === userId);
    }
  };

  // Get unread count for a user
  const getUnreadCount = (userId: number): number => {
    if (!messages || !user) return 0;
    return messages.filter(msg => !msg.read && msg.senderId === userId && msg.receiverId === user.id).length;
  };

  const selectedUser = selectedUserId ? getOtherUser(selectedUserId) : undefined;

  return (
    <section className="p-4 md:p-6 lg:p-8 h-[calc(100vh-64px)] lg:h-screen flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Messages</h2>
        <p className="text-gray-600">
          {isGuest
            ? 'الرسائل متاحة للعرض التجريبي فقط. أنشئ حسابا للمحادثة.'
            : (isCoach ? 'Communicate with your clients' : 'Connect with your coaches - Only coaches can receive messages')}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-lg border">
        {/* Users/Coaches List */}
        <div className="w-1/3 lg:w-1/4 border-r bg-white">
          <div className="p-4 border-b">
            <h3 className="font-medium">
              {isCoach ? 'Your Clients' : 'Your Coaches'}
            </h3>
          </div>
          <ScrollArea className="h-[calc(100%-57px)]">
            {isLoadingClients ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : isCoach ? (
              clients && clients.length > 0 ? (
                clients.map(client => {
                  const unreadCount = getUnreadCount(client.id);
                  return (
                    <div
                      key={client.id}
                      className={`flex items-center p-4 border-b cursor-pointer hover:bg-gray-50 relative ${
                        selectedUserId === client.id ? 'bg-blue-50' : ''
                      } ${unreadCount > 0 ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}
                      onClick={() => setSelectedUserId(client.id)}
                    >
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarFallback className="bg-primary text-white">
                          {getInitials(client.firstName, client.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-medium ${unreadCount > 0 ? 'text-blue-900' : ''}`}>
                            {unreadCount > 0 && (
                              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            )}
                            {client.firstName} {client.lastName}
                          </h4>
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs animate-pulse">
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">Member</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="p-4 text-center text-gray-500">No clients found</p>
              )
            ) : coaches && coaches.length > 0 ? (
              coaches.map(coach => {
                const unreadCount = getUnreadCount(coach.id);
                return (
                  <div
                    key={coach.id}
                    className={`flex items-center p-4 border-b cursor-pointer hover:bg-gray-50 relative ${
                      selectedUserId === coach.id ? 'bg-blue-50' : ''
                    } ${unreadCount > 0 ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}
                    onClick={() => setSelectedUserId(coach.id)}
                  >
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback className="bg-primary text-white">
                        {getInitials(coach.firstName, coach.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={`font-medium ${unreadCount > 0 ? 'text-blue-900' : ''}`}>
                          {unreadCount > 0 && (
                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                          )}
                          {coach.firstName} {coach.lastName}
                        </h4>
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs animate-pulse">
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">Coach</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="p-4 text-center text-gray-500">No coaches found</p>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="w-2/3 lg:w-3/4 flex flex-col bg-gray-50">
          {selectedUserId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b flex items-center">
                {selectedUser && (
                  <>
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarFallback className="bg-primary text-white">
                        {getInitials(selectedUser.firstName, selectedUser.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</h3>
                      <p className="text-sm text-gray-500">
                        {selectedUser.role === 'coach' ? 'Coach' : 'Member'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="flex justify-center p-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : messages && messages.length > 0 ? (
                  <div className="space-y-4">
                    {messages.map(msg => {
                      const isCurrentUser = msg.senderId === user?.id;
                      const isUnread = !msg.read && msg.receiverId === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="flex items-end">
                            {!isCurrentUser && (
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarFallback className="bg-primary text-white text-xs">
                                  {selectedUser ? getInitials(selectedUser.firstName, selectedUser.lastName) : '??'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div
                              className={`max-w-xs rounded-lg p-3 relative ${
                                isCurrentUser
                                  ? 'bg-primary text-white rounded-br-none'
                                  : `bg-white text-gray-800 rounded-bl-none ${isUnread ? 'border-l-4 border-l-red-500 bg-red-50' : ''}`
                              }`}
                            >
                              {isUnread && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                              )}
                              <p>{msg.content}</p>
                              <div
                                className={`text-xs mt-1 flex items-center justify-between ${
                                  isCurrentUser ? 'text-blue-100' : 'text-gray-500'
                                }`}
                              >
                                <div className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatInAppTz(new Date(msg.sentAt), 'h:mm a')}
                                </div>
                                {isUnread && (
                                  <span className="text-red-500 font-medium ml-2">• Unread</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <p>No messages yet</p>
                    <p className="text-sm">Send a message to start the conversation</p>
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 bg-white border-t">
                <div className="flex">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 mr-2"
                    disabled={isGuest}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isGuest || !message.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isGuest ? 'إنشاء حساب' : 'Send'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p>Select a {isCoach ? 'client' : 'coach'} to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Messages;

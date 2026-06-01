import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, User } from 'lucide-react';
import { Link } from 'wouter';

const MessagesOverview: React.FC = () => {
  // Mock recent messages data
  const recentMessages = [
    {
      id: 1,
      sender: "Coach Naioshfit",
      message: "Great progress on your workouts this week! Keep it up.",
      time: "2 hours ago",
      unread: true
    },
    {
      id: 2,
      sender: "Coach Naioshfit", 
      message: "Remember to log your meals for today's nutrition tracking.",
      time: "1 day ago",
      unread: false
    },
    {
      id: 3,
      sender: "Coach Naioshfit",
      message: "Your next workout plan is ready. Check it out!",
      time: "3 days ago", 
      unread: false
    }
  ];

  const unreadCount = recentMessages.filter(msg => msg.unread).length;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
              <MessageSquare className="text-primary text-lg" />
            </div>
            <div>
              <h4 className="font-medium">Messages</h4>
              <p className="text-sm text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>
          <Link href="/messages">
            <Button variant="outline" size="sm">Inbox</Button>
          </Link>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {recentMessages.slice(0, 3).map((message) => (
              <div key={message.id} className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="text-white text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${message.unread ? 'text-gray-900' : 'text-gray-600'}`}>
                      {message.sender}
                    </p>
                    <span className="text-xs text-gray-500">{message.time}</span>
                  </div>
                  <p className={`text-sm mt-1 ${message.unread ? 'text-gray-900 font-medium' : 'text-gray-600'} truncate`}>
                    {message.message}
                  </p>
                  {message.unread && (
                    <div className="w-2 h-2 bg-primary rounded-full mt-1"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link href="/messages">
            <Button variant="link" className="w-full mt-3 text-primary">
              View all messages →
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default MessagesOverview;
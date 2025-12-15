"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pin, Loader2 } from "lucide-react";
import type { NewsPost } from "@/types/domain";

export default function NewsPage() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", body: "" });

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("news_posts")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    setPosts(
      (data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        createdAt: p.created_at,
        createdBy: p.created_by,
        isPinned: p.is_pinned,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleAddPost = async () => {
    if (!newPost.title || !newPost.body) return;

    await supabase.from("news_posts").insert({
      title: newPost.title,
      body: newPost.body,
      is_pinned: false,
    });

    setNewPost({ title: "", body: "" });
    setShowAddForm(false);
    fetchPosts();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Company News</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-news">
          <Plus className="h-4 w-4 mr-2" />
          Add News
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Create News Post</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                placeholder="Title"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                data-testid="input-news-title"
              />
              <Textarea
                placeholder="Content..."
                value={newPost.body}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewPost({ ...newPost, body: e.target.value })}
                rows={4}
                data-testid="input-news-body"
              />
              <Button onClick={handleAddPost} data-testid="button-save-news">
                Publish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} data-testid={`card-news-${post.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{post.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(post.createdAt)}
                  </p>
                </div>
                {post.isPinned && (
                  <Badge variant="secondary">
                    <Pin className="h-3 w-3 mr-1" />
                    Pinned
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{post.body}</p>
            </CardContent>
          </Card>
        ))}

        {posts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No news posts yet. Click &quot;Add News&quot; to create your first post.
          </div>
        )}
      </div>
    </div>
  );
}

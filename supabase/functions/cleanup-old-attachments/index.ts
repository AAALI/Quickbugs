// Deno Edge Function to clean up old report attachments (7+ days)
// Triggered via cron: runs daily to delete files older than 7 days

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    // Only allow POST requests (cron triggers use POST)
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify the request is from Supabase cron (optional: add auth header check)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[cleanup] Starting cleanup of attachments older than 7 days...");

    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffIso = cutoffDate.toISOString();

    console.log("[cleanup] Cutoff date:", cutoffIso);

    // List all files in report-attachments bucket older than 7 days
    const { data: files, error: listError } = await supabase
      .storage
      .from("report-attachments")
      .list("", {
        limit: 1000,
        sortBy: { column: "created_at", order: "asc" },
      });

    if (listError) {
      console.error("[cleanup] Error listing files:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to list files", details: listError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!files || files.length === 0) {
      console.log("[cleanup] No files found in bucket");
      return new Response(
        JSON.stringify({ message: "No files to clean up", deleted: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Filter files older than 7 days
    const oldFiles = files.filter((file) => {
      if (!file.created_at) return false;
      return new Date(file.created_at) < cutoffDate;
    });

    console.log(`[cleanup] Found ${oldFiles.length} files older than 7 days`);

    if (oldFiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No old files to delete", deleted: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete old files (batch delete)
    const filePaths = oldFiles.map((file) => file.name);
    
    const { data: deleteData, error: deleteError } = await supabase
      .storage
      .from("report-attachments")
      .remove(filePaths);

    if (deleteError) {
      console.error("[cleanup] Error deleting files:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete files", details: deleteError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[cleanup] Successfully deleted ${deleteData?.length || 0} files`);

    return new Response(
      JSON.stringify({
        message: "Cleanup completed",
        deleted: deleteData?.length || 0,
        files: filePaths,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[cleanup] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

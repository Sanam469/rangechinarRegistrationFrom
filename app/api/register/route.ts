// app/api/register/route.ts
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { uploadOnCloudinary } from "./cloudinary";
import path from "path";

export async function POST(req: Request) {
  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), "public", "temp");
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.error("Error creating temp directory:", error);
  }

  // Get the form data for file
  const formData = await req.formData();
  const avatar = formData.get("avatar") as File;
  const jsonData = formData.get("data"); // Get JSON data as string

  if (!jsonData) {
    return NextResponse.json(
      { error: "Registration data is required." },
      { status: 400 }
    );
  }

  // Parse the JSON data
  const {
    first_name,
    last_name,
    email,
    phone,
    organization,
    state,
    gender,
    is_nit_student,
    txn_id,
    selected_events,
    amount,
    attend_day1,
    attend_day2,
    participant_category,
  } = JSON.parse(jsonData as string);

  let avatarUrl = null;
  if (avatar) {
    try {
      // Save file temporarily
      const bytes = await avatar.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const tempPath = path.join(tempDir, `${Date.now()}-${avatar.name}`);
      await fs.writeFile(tempPath, buffer);

      // Upload to Cloudinary
      const uploadResult = await uploadOnCloudinary(tempPath);
      if (uploadResult) {
        avatarUrl = uploadResult.url;
      } else {
        console.error("Failed to upload image to Cloudinary");
      }
    } catch (error) {
      console.error("Error handling file upload:", error);
      return NextResponse.json(
        { error: "Failed to process image upload." },
        { status: 500 }
      );
    }
  }

  // ✅ Check if UID/email already registered
  const { data: existingEmail } = await supabase
    .from("participants")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingEmail) {
    return NextResponse.json(
      { error: "This email is already registered." },
      { status: 400 }
    );
  }

  // ✅ Insert participant including UID
  const { data: participant, error: insertError } = await supabase
    .from("participants")
    .insert([
      {
        first_name,
        last_name,
        email,
        phone,
        organization,
        state,
        gender,
        nit: is_nit_student, // Renaming is_nit_student to nit as required
        txn_id,
        amount,
        attend_day1,
        attend_day2,
        participant_category,
        avatar: avatarUrl,
      },
    ])
    .select()
    .single();

  if (insertError || !participant) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to insert participant." },
      { status: 500 }
    );
  }

  // ✅ Register event entries
  const registrations = selected_events.map((event_id: string) => ({
    event_id,
    participant_id: participant.id,
  }));

  const { error: regError } = await supabase
    .from("event_registrations")
    .insert(registrations);

  if (regError) {
    return NextResponse.json({ error: regError.message }, { status: 500 });
  }

  // Create a summary of days attending for the response
  let daysAttending = "";
  if (attend_day1 && attend_day2) {
    daysAttending = "both days";
  } else if (attend_day1) {
    daysAttending = "day 1";
  } else if (attend_day2) {
    daysAttending = "day 2";
  }

  return NextResponse.json({
    success: true,
    message: "Registration successful",
    details: {
      name: `${first_name} ${last_name}`,
      events_registered: selected_events.length,
      attending: daysAttending,
      total_amount: amount,
    },
  });
}

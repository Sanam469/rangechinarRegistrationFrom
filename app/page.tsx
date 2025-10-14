"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

const registrationSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z
    .string()
    .length(10, "Phone number must be only 10 digits")
    .regex(/^\d+$/, "Phone must contain only numbers")
    .transform((val) => Number(val)),
  organization: z.string().min(1, "Organization is required"),
  state: z.string().min(1, "State is required"),
  gender: z.string().min(1, "Gender is required"),
  is_nit_student: z.boolean(),
  participant_category: z.string().optional(),
  selected_events: z.array(z.string()),
  attend_day1: z.boolean(),
  attend_day2: z.boolean(),

  agree_to_rules: z.boolean().refine(val => val === true, {
    message: "You must agree to the event rules"
  }),
 photo: z.instanceof(File).nullable().optional()
});

type RegistrationData = z.input<typeof registrationSchema>;

interface Event {
  id: string | number;
  name: string;
  description: string;
  sub_category: string;
  fee: number;
  category: string;
  day: string; // "1", "2", or "1 2"
  photo?: File | null; 

}

// Fee categories
const participantCategories = [
  { id: "school", name: "School Student (till Class 10)", fee: 20 },
  { id: "college", name: "College Student (Including Class 11 & 12)", fee: 29 },
  { id: "alumni", name: "NIT Alumni ", fee: 299 },
  { id: "others", name: "Others (With Any govt ID)", fee: 999 }
];

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [activeDay, setActiveDay] = useState("1"); // Default to day 1
  const [showRules, setShowRules] = useState(false);
  const [totalFee, setTotalFee] = useState(0);
  const [entryFee, setEntryFee] = useState(0);
  const [eventsFee, setEventsFee] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const [showPreview, setShowPreview] = useState(false);

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0] ?? null;

  setForm((prev) => ({
    ...prev,   // keep all existing fields
    photo: file // update only photo
  }));

  setPreviewUrl(file ? URL.createObjectURL(file) : null);
  setShowPreview(false); // reset preview on new file
};


  const togglePreview = () => setShowPreview((prev) => !prev);



  const [form, setForm] = useState<RegistrationData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    organization: "",
    state: "",
    gender: "",
    is_nit_student: false,
    participant_category: "college", // Default to college student
    selected_events: [],
    attend_day1: true, // Default to attending day 1
    attend_day2: false,
    agree_to_rules: false,
   photo: null, 
  });

   

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        const eventsArray = Array.isArray(data) ? data : data.events || [];
        
        setEvents(eventsArray);
        setFilteredEvents(eventsArray.filter((event:any) => event.day.includes(activeDay)));
      })
      .catch((err) => {
        console.error("Error fetching events:", err);
        setEvents([]);
        setFilteredEvents([]);
      });
  }, []);
  

  // Helper function to check if an event is a haunted house event
  const isHauntedHouseEvent = (event: Event) => {
    return event.name.toLowerCase().includes("haunted house");
  };

  // Check if selected events are from days the user hasn't selected
  useEffect(() => {
    // If user deselects a day, automatically deselect events from that day
    if (!form.attend_day1 || !form.attend_day2) {
      const updatedSelectedEvents = form.selected_events.filter(eventId => {
        const event = events.find(e => String(e.id) === eventId);
        if (!event) return false;
        
        // Keep event if it's on a day the user is attending
        if (form.attend_day1 && event.day.includes("1")) return true;
        if (form.attend_day2 && event.day.includes("2")) return true;
        return false;
      });
      
      if (updatedSelectedEvents.length !== form.selected_events.length) {
        setForm(prev => ({
          ...prev,
          selected_events: updatedSelectedEvents
        }));
      }
    }
  }, [form.attend_day1, form.attend_day2, events]);

  // Auto-select days if user selects events from those days
  useEffect(() => {
    let needsDay1 = false;
    let needsDay2 = false;

    form.selected_events.forEach(eventId => {
      const event = events.find(e => String(e.id) === eventId);
      if (!event) return;

      if (event.day.includes("1")) needsDay1 = true;
      if (event.day.includes("2")) needsDay2 = true;
    });

    // Auto-update day selection if needed
    if ((needsDay1 && !form.attend_day1) || (needsDay2 && !form.attend_day2)) {
      setForm(prev => ({
        ...prev,
        attend_day1: needsDay1 ? true : prev.attend_day1,
        attend_day2: needsDay2 ? true : prev.attend_day2
      }));
    }
  }, [form.selected_events, events]);

  // Calculate fees whenever relevant form fields change
  useEffect(() => {
    // Get selected events
    const selectedEventObjs = events.filter((event) =>
      form.selected_events.includes(String(event.id))
    );
    
    // Initialize event fees
    let newEventsFee = 0;
    let newEntryFee = 0;
    
    if (form.is_nit_student) {
      // For NIT students: Charge for Workshop category AND Haunted House events
      newEventsFee = selectedEventObjs
        .filter(event => event.category === "Workshop" || isHauntedHouseEvent(event))
        .reduce((sum, ev) => sum + ev.fee, 0);
      // NIT students don't pay entry fee
      newEntryFee = 0;
    } else {
      // For non-NIT participants: Charge for event fees
      newEventsFee = selectedEventObjs.reduce((sum, ev) => sum + ev.fee, 0);
      
      // Charge entry fee for each day selected
      const selectedCategory = participantCategories.find(cat => cat.id === form.participant_category);
      const dailyEntryFee = selectedCategory ? selectedCategory.fee : 29; // Default to college student fee
      
      if (form.attend_day1) newEntryFee += dailyEntryFee;
      if (form.attend_day2) newEntryFee += dailyEntryFee;
    }
    
    setEventsFee(newEventsFee);
    setEntryFee(newEntryFee);
    setTotalFee(newEventsFee + newEntryFee);
  }, [form.selected_events, form.is_nit_student, form.participant_category, form.attend_day1, form.attend_day2, events]);

  const handleInput = (key: keyof RegistrationData, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleEvent = (id: string | number) => {
    const idStr = String(id);
    setForm((prev) => {
      const updated = prev.selected_events.includes(idStr)
        ? prev.selected_events.filter((e) => e !== idStr)
        : [...prev.selected_events, idStr];
      return { ...prev, selected_events: updated };
    });
  };

  const handleRulesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowRules(true);
  };

  const handleCloseRules = () => {
    setShowRules(false);
  };

 const handleSubmit = async () => {

  if (!form.attend_day1 && !form.attend_day2) {
    alert("Please select at least one day to attend");
    return;
  }

 
  const result = registrationSchema.safeParse(form);
  if (!result.success) {
    console.error("Validation error:", result.error.format());
    alert(result.error.errors[0].message);
    return;
  }

  try {
   
    const formData = new FormData();

    if (form.photo) {
      formData.append("avatar", form.photo);
    }

    
    const otherData = {
      ...result.data,
      total_fee: totalFee,
      entry_fee: entryFee,
      events_fee: eventsFee
    };
    formData.append("data", JSON.stringify(otherData));

    
    const res = await fetch("/api/register", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Registration failed:", error);
      alert("Registration failed. Please try again.");
      return;
    }

    const responseData = await res.json();
    console.log("Registration successful:", responseData);

    alert("Registration successful!");
    router.push("/payment"); 
  } catch (err) {
    console.error("Error submitting registration:", err);
    alert("An error occurred. Please try again.");
  }
};


  const uniqueCategories = ["All", ...new Set(events.map((e) => e.category))];

  // Filter events based on selected day and category
  useEffect(() => {
    setFilteredEvents(
      events
        .filter(e => e.day.includes(activeDay))
        .filter(e => categoryFilter === "All" ? true : e.category === categoryFilter)
    );
  }, [categoryFilter, events, activeDay]);

  // Switch between day tabs
  const switchDay = (day: string) => {
    setActiveDay(day);
    setCategoryFilter("All"); // Reset category filter when switching days
  };

  // Display message about fee policy based on user type
  const getFeeExplanation = () => {
    if (form.is_nit_student) {
      return (
        <div className="mt-2 bg-green-50 p-3 rounded-lg text-sm">
          <p className="font-medium text-green-700">Fee Policy for NIT Students:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Workshop events: Regular fee applies</li>
            <li>Haunted House: Regular fee applies</li>
            <li>All other events: Free (no charge)</li>
          </ul>
        </div>
      );
    } else {
      return (
        <div className="mt-2 bg-indigo-50 p-3 rounded-lg text-sm">
          <p className="font-medium text-indigo-700 mb-1">Fee Policy for External Participants:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Event registration: Regular event fees apply</li>
            <li>Entry fee: <span className="font-medium">Required for each day attending ({form.attend_day1 && form.attend_day2 ? "both days" : "one day"})</span></li>
          </ul>
        </div>
      );
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-10 text-center text-indigo-900">
        🌟 Rang-e-Chinar 2.0 Event Registration
      </h1>

      {/* Personal Info */}
      <section className="space-y-6 bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-indigo-100">
        <h2 className="text-xl font-semibold text-indigo-800 flex items-center">
          <span className="mr-2">👤</span> Personal Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => handleInput("first_name", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
              placeholder="Enter first name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => handleInput("last_name", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
              placeholder="Enter last name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleInput("email", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={form.phone as string}
              onChange={(e) => handleInput("phone", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
              placeholder="10-digit number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization
            </label>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => handleInput("organization", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
              placeholder="Your organization/college"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => handleInput("state", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
              placeholder="Your state"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={form.gender}
              onChange={(e) => handleInput("gender", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center">
            <div className="flex items-center mr-6 mb-2 sm:mb-0">
              <input
                type="checkbox"
                id="is_nit_student"
                checked={form.is_nit_student}
                onChange={(e) => handleInput("is_nit_student", e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 mr-2"
              />
              <label htmlFor="is_nit_student" className="text-sm font-medium text-gray-700">
                NIT Srinagar Student 
              </label>
            </div>
            
            {/* Participant Category Dropdown - Only show when not an NIT student */}
            {!form.is_nit_student && (
              <div className="w-full">
                <select
                  value={form.participant_category}
                  onChange={(e) => handleInput("participant_category", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all text-sm"
                >
                  {participantCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} - ₹{category.fee}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

<div className="flex flex-col items-start gap-2">
  <label className="font-medium text-gray-700">
    Upload Your Photo for the Ticket
  </label>

  <div className="flex items-center gap-2">
    <label
      className="cursor-pointer bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 active:bg-indigo-700 transition-all"
    >
      Choose File
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </label>

    <button
      type="button"
      onClick={() => setShowPreview(prev => !prev)}
      disabled={!form.photo}
      className={`px-4 py-2 rounded border ${
        form.photo
          ? "bg-white text-indigo-700 border-indigo-500 hover:bg-indigo-50"
          : "bg-gray-200 text-gray-400 cursor-not-allowed"
      } transition-all`}
    >
      Preview
    </button>
  </div>

  {/* Selected file name */}
  {form.photo && (
    <p className="text-sm text-gray-700 mt-1">Selected file: {form.photo.name}</p>
  )}

  {/* Image preview */}
  {showPreview && previewUrl && (
    <img
      src={previewUrl}
      alt="Ticket Preview"
      className="mt-2 w-32 h-32 object-cover rounded border"
    />
  )}
</div>





        </div>

        {/* Day Selection */}
        <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
          <h3 className="text-lg font-medium text-indigo-800 mb-3">
            Select Days to Attend
          </h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={form.attend_day1}
                onChange={(e) => handleInput("attend_day1", e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
              />
              <span className="font-medium">Day 1</span>
              {!form.is_nit_student && (
                <span className="text-sm text-gray-600 ml-1">
                  (₹{participantCategories.find(cat => cat.id === form.participant_category)?.fee || 29} entry fee)
                </span>
              )}
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={form.attend_day2}
                onChange={(e) => handleInput("attend_day2", e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
              />
              <span className="font-medium">Day 2</span>
              {!form.is_nit_student && (
                <span className="text-sm text-gray-600 ml-1">
                  (₹{participantCategories.find(cat => cat.id === form.participant_category)?.fee || 29} entry fee)
                </span>
              )}
            </label>
          </div>
          {(!form.attend_day1 && !form.attend_day2) && (
            <p className="text-red-500 text-sm mt-2">Please select at least one day to attend</p>
          )}
        </div>

        {/* Fee Explanation */}
        {getFeeExplanation()}
      </section>

      {/* Event Selection */}
      <section className="mt-8 sm:mt-12">
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-indigo-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h2 className="text-xl font-semibold text-indigo-800 flex items-center mb-2 sm:mb-0">
              <span className="mr-2">🎯</span> Select Events
            </h2>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
            >
              {uniqueCategories.map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Day Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => switchDay("1")}
              className={`py-2 px-4 font-medium transition-all ${
                activeDay === "1"
                  ? "border-b-2 border-indigo-500 text-indigo-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Day 1 {!form.attend_day1 && <span className="text-amber-500 text-xs">(Not Attending)</span>}
            </button>
            <button
              onClick={() => switchDay("2")}
              className={`py-2 px-4 font-medium transition-all ${
                activeDay === "2"
                  ? "border-b-2 border-indigo-500 text-indigo-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Day 2 {!form.attend_day2 && <span className="text-amber-500 text-xs">(Not Attending)</span>}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredEvents.map((event) => {
              const eventId = String(event.id);
              // Determine if this event should have a special indicator (free for NIT students)
              const isFreeForNIT = form.is_nit_student && 
                event.category !== "Workshop" && 
                !isHauntedHouseEvent(event);
              
              // Check if this event is from a day the user isn't attending
              const eventDay = event.day;
              const dayNotSelected = (eventDay.includes("1") && !form.attend_day1) || 
                                     (eventDay.includes("2") && !form.attend_day2);
              
              return (
                <label
                  key={eventId}
                  className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    form.selected_events.includes(eventId)
                      ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200"
                      : dayNotSelected 
                        ? "bg-gray-100 border-gray-200 opacity-60" 
                        : "bg-white border-gray-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                      checked={form.selected_events.includes(eventId)}
                      onChange={() => toggleEvent(event.id)}
                    />
                    <div>
                      <h3 className="font-bold text-lg text-indigo-900">
                        {event.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-1">
                        {event.description}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Category:</span> {event.sub_category}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-indigo-600">
                          Fee: {isFreeForNIT ? (
                            <span className="text-green-600">Free for NIT Students</span>
                          ) : (
                            <span>₹{event.fee}</span>
                          )}
                        </p>
                        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                          Day {event.day}
                        </span>
                      </div>
                      {dayNotSelected && (
                        <p className="text-xs text-amber-600 mt-1">
                          Note: Selecting this event will add Day {event.day} to your registration
                        </p>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* Rules Agreement */}
      <section className="mt-6 sm:mt-8 p-4 sm:p-6 bg-white rounded-2xl shadow-lg border border-indigo-100">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="agree_to_rules"
            className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
            checked={form.agree_to_rules}
            onChange={(e) => handleInput("agree_to_rules", e.target.checked)}
          />
          <div>
            <label htmlFor="agree_to_rules" className="font-medium text-gray-700">
              I agree to the event rules and guidelines
            </label>
            <p className="text-sm text-gray-500 mt-1">
              By checking this box, you confirm that you have read and agree to follow all 
              <a 
                href="#" 
                onClick={handleRulesClick}
                className="text-indigo-600 underline ml-1 hover:text-indigo-800 transition-colors"
              >
                event rules and regulations
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Final Fee Summary Card */}
      <section className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl shadow-lg text-white">
        <h2 className="text-xl font-semibold mb-4">Payment Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-white bg-opacity-90 rounded-lg p-3 text-gray-900">
            <p className="text-sm text-gray-700">Events Fee</p>
            <p className="text-2xl font-bold">₹{eventsFee}</p>
            {form.is_nit_student && (
              <p className="text-xs text-green-600 mt-1">
                *Only workshops & haunted house
              </p>
            )}
          </div>
          <div className="bg-white bg-opacity-90 rounded-lg p-3 text-gray-900">
            <p className="text-sm text-gray-700">Entry Fee</p>
            <p className="text-2xl font-bold">₹{entryFee}</p>
            {!form.is_nit_student && (
              <p className="text-xs text-amber-600 mt-1">
                *{form.attend_day1 && form.attend_day2 ? "Both days" : "One day"}
              </p>
            )}
          </div>
          <div className="bg-white bg-opacity-90 rounded-lg p-3 text-gray-900">
            <p className="text-sm text-gray-700">Total Fee</p>
            <p className="text-2xl font-bold">₹{totalFee}</p>
          </div>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={handleSubmit}
            className="bg-white text-indigo-700 text-lg px-8 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 font-bold"
          >
            ✅ Proceed to Payment
          </button>
        </div>
      </section>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl max-h-[80vh] overflow-y-auto w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-indigo-900">Event Rules and Regulations</h2>
              <button 
                onClick={handleCloseRules}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold text-indigo-800 border-b pb-2 mb-4">
                Range-e-Chinar 2.0 Event Rules
              </h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Identification Requirements</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>All participants must carry a valid government-issued ID (Aadhar, PAN, Driving License). Entry will be granted only after verification at the registration/security desk.</li>
                    <li>Students without their college/school ID cards are not allowed inside.</li>
                    <li>Presenting fake ID to access the event or avoid applicable fees is strictly prohibited.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Entry Fee Details</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>School Students (till Class 10) – Rs.20</li>
                    <li>College Students (Including Class 11 & 12) – Rs.29</li>
                    <li>NIT alumni – Rs.299</li>
                    <li>Others (With Any govt ID) – Rs.999</li>
                    <li className="text-amber-700 font-medium">*Entry fee is required for all external participants</li>
                    <li className="text-green-700 font-medium">*NIT students participate in most events for free, except workshops and haunted house</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Entry Band Rules</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Participants must wear their bands provided during registration at all times.</li>
                    <li>If participants leave the campus during the event, they must remove the previous band and register and pay again to get a new band.</li>
                    <li>Each participant should purchase 2 different bands for Day 1 and Day 2.</li>
                    <li>The institution is not responsible for replacing lost or damaged bands.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Game Zone Registration</h4>
                  <p>
                    Participants registering for game zone activities must pay a separate registration fee at the game zone registration desk available near the main gate and Chinar premises (in addition to the entry fee).
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Prohibited Items</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Sharp objects</li>
                    <li>Weapons of any kind</li>
                    <li>Fireworks or explosives</li>
                    <li>Alcoholic beverages or illegal substances</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Safety and Security</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Security personnel have the right to inspect bags or belongings at entry points.</li>
                    <li>Follow all instructions given by security staff and volunteers.</li>
                    <li>The organizers are not responsible for loss of personal belongings.</li>
                    <li>In case of emergencies, follow announcements and emergency evacuation plans.</li>
                    <li>Report any suspicious activity or unattended bags to security personnel immediately.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Conduct Policy</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Participants must maintain discipline and respectful behavior throughout the event.</li>
                    <li>Any form of harassment, abuse, or physical altercation will result in immediate disqualification and removal.</li>
                    <li>Avoid damage to event property, decorations, or any campus infrastructure.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-gray-800 mb-2">Violations</h4>
                  <p>Violations of these rules may result in:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Immediate removal from the event premises</li>
                    <li>Reporting to local authorities (in serious cases)</li>
                    <li>Disqualification from participation or award</li>
                    <li>Accountability for damages</li>
                  </ul>
                </div>
              </div>

              <p className="mt-6 pt-4 border-t text-gray-700 italic">
                <strong>Note:</strong> The organizing committee reserves the right to make changes to the rules and schedule as needed. Any updates will be communicated to registered participants.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

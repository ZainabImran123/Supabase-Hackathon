const SUPABASE_URL = "https://xswkxjymswnveppratwx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzd2t4anltc3dudmVwcHJhdHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTQ5NTYsImV4cCI6MjEwMjM3MDk1Nn0.sOZhMZMfIBXKn9QgcPLUz9rmpwlHfNE52Bu8RBXIki0";

let _supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Supabase SDK not loaded properly. Check your script tags in HTML.");
}

let currentUser = null;
let currentFilter = "upcoming";

function getUserDisplayName(user) {
    if (!user) return "Anonymous";
    if (typeof user === 'string') return user.split('@')[0];
    return user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : "Anonymous");
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!_supabase) return;

    // 1. Fetch active session directly from local storage
    const { data: { session }, error } = await _supabase.auth.getSession();

    // 2. Redirect to index.html ONLY if no session exists
    if (error || !session) {
        window.location.href = "index.html";
        return;
    }

    // 3. Populate current user state
    currentUser = session.user;

    const charBtn = document.getElementById("char");
    if (charBtn && currentUser) {
        const name = getUserDisplayName(currentUser);
        charBtn.innerText = name.charAt(0).toUpperCase();
    }

    const eventForm = document.getElementById("eventForm");
    if (eventForm) {
        eventForm.removeEventListener("submit", createEvent);
        eventForm.addEventListener("submit", createEvent);
    }

    fetchEvents();

    // 4. Handle ONLY explicit sign-outs (prevents initial auth event redirect loops)
    _supabase.auth.onAuthStateChange((event, currentSession) => {
        if (event === "SIGNED_OUT") {
            window.location.href = "index.html";
        }
    });
});

function toggleMenu() {
    const menu = document.getElementById("dropdownMenu");
    if (menu) menu.classList.toggle("show");
}

async function logout() {
    if (_supabase) await _supabase.auth.signOut();
    window.location.href = "index.html";
}

function previewEventImage(input) {
    const previewContainer = document.getElementById("eventImagePreviewContainer");
    const previewImage = document.getElementById("eventImagePreview");
    const uploadText = document.getElementById("eventUploadText");

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (previewImage) previewImage.src = e.target.result;
            if (previewContainer) previewContainer.classList.remove("d-none");
        };
        reader.readAsDataURL(input.files[0]);
        if (uploadText) uploadText.innerText = "Change Image";
    } else {
        if (previewImage) previewImage.src = "";
        if (previewContainer) previewContainer.classList.add("d-none");
        if (uploadText) uploadText.innerText = "Add Image";
    }
}

function resetEventForm() {
    const form = document.getElementById("eventForm");
    if (form) form.reset();
    const previewContainer = document.getElementById("eventImagePreviewContainer");
    if (previewContainer) previewContainer.classList.add("d-none");
    const uploadText = document.getElementById("eventUploadText");
    if (uploadText) uploadText.innerText = "Add Image";
}

async function createEvent(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (!_supabase || !currentUser) {
        Swal.fire("Error", "User session or Supabase client not ready.", "error");
        return false;
    }

    const title = document.getElementById("eventTitle") ? document.getElementById("eventTitle").value.trim() : "";
    const description = document.getElementById("eventDescription") ? document.getElementById("eventDescription").value.trim() : "";
    const event_date = document.getElementById("eventDate") ? document.getElementById("eventDate").value : "";
    const rawTime = document.getElementById("eventTime") ? document.getElementById("eventTime").value : "";
    const location = document.getElementById("eventLocation") ? document.getElementById("eventLocation").value.trim() : "";
    const fileInput = document.getElementById("eventImage");
    const file = fileInput ? fileInput.files[0] : null;

    if (!title || !description || !event_date || !rawTime || !location) {
        Swal.fire("Error", "Please fill in all required fields.", "error");
        return false;
    }

    // Format raw HH:MM time input to standard 12-hour AM/PM string
    let formattedTime = rawTime;
    if (rawTime.includes(":")) {
        const [hours, minutes] = rawTime.split(":");
        const dateObj = new Date();
        dateObj.setHours(parseInt(hours, 10));
        dateObj.setMinutes(parseInt(minutes, 10));
        formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    let imageUrl = null;

    Swal.fire({
        title: "Creating Event...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        if (file) {
            const fileName = `event_${Date.now()}_${file.name}`;
            const { error: uploadError } = await _supabase.storage
                .from("post-images")
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = _supabase.storage
                .from("post-images")
                .getPublicUrl(fileName);

            imageUrl = urlData?.publicUrl || urlData?.publicURL || null;
        }

        const payload = {
            title,
            description,
            location,
            image_url: imageUrl,
            user_id: currentUser.id,
            event_date,
            event_time: formattedTime,
            author_name: getUserDisplayName(currentUser)
        };

        const { error } = await _supabase.from("events").insert([payload]);

        if (error) throw error;

        Swal.fire("Success!", "Event created successfully.", "success");
        resetEventForm();
        fetchEvents();

    } catch (error) {
        Swal.fire("Error", error.message, "error");
    }

    return false;
}

async function fetchEvents() {
    const eventsContainer = document.getElementById("eventsContainer");
    if (!eventsContainer || !_supabase) return;

    eventsContainer.innerHTML = '<div class="text-center text-secondary py-4"><i class="fa-solid fa-spinner fa-spin fs-3"></i></div>';

    try {
        const { data: events, error: eventsError } = await _supabase.from("events").select("*");
        if (eventsError) throw eventsError;

        events.sort((a, b) => {
            const dateA = new Date(a.event_date || a.date || a.created_at);
            const dateB = new Date(b.event_date || b.date || b.created_at);
            return dateA - dateB;
        });

        let registrations = [];
        const regRes = await _supabase.from("event_registrations").select("*");
        if (regRes.error) {
            const fallbackRegRes = await _supabase.from("event-registrations").select("*");
            registrations = fallbackRegRes.data || [];
        } else {
            registrations = regRes.data || [];
        }

        eventsContainer.innerHTML = "";

        if (!events || events.length === 0) {
            eventsContainer.innerHTML = '<p class="text-secondary text-center py-4">No events found.</p>';
            return;
        }

        const today = new Date().toISOString().split("T")[0];

        const filteredEvents = events.filter(item => {
            const itemDate = item.event_date || item.date || "";
            if (currentFilter === "upcoming") return itemDate >= today;
            if (currentFilter === "past") return itemDate < today;
            return true;
        });

        if (filteredEvents.length === 0) {
            eventsContainer.innerHTML = `<p class="text-secondary text-center py-4">No ${currentFilter} events found. Try switching filters.</p>`;
            return;
        }

        for (const item of filteredEvents) {
            const card = document.createElement("div");
            card.className = "col-md-6 mb-4 event-card-item";

            const eventRegs = registrations.filter(r => r.event_id === item.id || r["event-id"] === item.id);
            const participantCount = eventRegs.length;
            const isRegistered = eventRegs.some(r => r.user_id === currentUser?.id || r["user-id"] === currentUser?.id);
            const isOwner = currentUser && (currentUser.id === item.user_id || currentUser.id === item["user-id"]);

            const displayDate = item.event_date || item.date || "N/A";
            let displayTime = item.event_time || item.time || "N/A";

            if (displayTime === "00:00:00" || displayTime === "00:00") {
                displayTime = "Time Not Set";
            }

            const author = item.author_name || item["author-name"] || "Anonymous";

            card.innerHTML = `
        <div class="card event-card bg-dark text-light border-secondary shadow-lg h-100">
          ${item.image_url ? `
            <div class="text-center bg-black p-2">
              <img src="${item.image_url}" class="img-fluid rounded" style="max-height: 180px; object-fit: contain;" alt="Event image">
            </div>
          ` : ""}
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <small class="text-info fw-bold"><i class="fa-solid fa-user me-1"></i>${author}</small>
              <span class="badge bg-secondary"><i class="fa-solid fa-users me-1"></i>${participantCount} Joined</span>
            </div>
            <h5 class="card-title event-title fw-bold text-info">${item.title}</h5>
            <p class="card-text event-description text-light flex-grow-1">${item.description}</p>
            
            <div class="my-3 p-2 bg-black rounded border border-secondary small">
              <div class="text-warning mb-1"><i class="fa-regular fa-calendar me-2"></i><strong>Date:</strong> ${displayDate}</div>
              <div class="text-warning mb-1"><i class="fa-regular fa-clock me-2"></i><strong>Time:</strong> ${displayTime}</div>
              <div class="text-warning"><i class="fa-solid fa-location-dot me-2"></i><strong>Location:</strong> ${item.location}</div>
            </div>

            <div class="d-flex justify-content-between align-items-center mt-2">
              ${isRegistered ? `
                <button class="btn btn-sm btn-outline-danger fw-bold" onclick="cancelRegistration('${item.id}')">
                  <i class="fa-solid fa-user-minus me-1"></i>Cancel Registration
                </button>
              ` : `
                <button class="btn btn-sm btn-info text-dark fw-bold" onclick="joinEvent('${item.id}')">
                  <i class="fa-solid fa-user-plus me-1"></i>Register Now
                </button>
              `}
              
              ${isOwner ? `
                <button class="btn btn-sm text-danger p-0 ms-2" onclick="deleteEvent('${item.id}')">
                  <i class="fa-solid fa-trash fs-5"></i>
                </button>
              ` : ""}
            </div>
          </div>
        </div>
      `;

            eventsContainer.appendChild(card);
        }

    } catch (error) {
        eventsContainer.innerHTML = `<p class="text-danger">Failed to load events: ${error.message}</p>`;
    }
}

async function joinEvent(eventId) {
    if (!_supabase || !currentUser || !eventId || eventId === "undefined") return;

    try {
        const authorName = getUserDisplayName(currentUser);
        const payload = {
            event_id: eventId,
            user_id: currentUser.id,
            user_name: authorName
        };

        let { error } = await _supabase.from("event_registrations").insert([payload]);
        if (error) {
            const fallback = await _supabase.from("event-registrations").insert([payload]);
            if (fallback.error) throw fallback.error;
        }

        Swal.fire("Registered!", "You have successfully registered for this event.", "success");
        fetchEvents();

    } catch (error) {
        Swal.fire("Error", error.message, "error");
    }
}

async function cancelRegistration(eventId) {
    if (!_supabase || !currentUser || !eventId || eventId === "undefined") return;

    try {
        let { error } = await _supabase.from("event_registrations").delete().eq("event_id", eventId).eq("user_id", currentUser.id);
        if (error) {
            const fallback = await _supabase.from("event-registrations").delete().eq("event_id", eventId).eq("user_id", currentUser.id);
            if (fallback.error) throw fallback.error;
        }

        Swal.fire("Cancelled", "Your registration has been removed.", "info");
        fetchEvents();

    } catch (error) {
        Swal.fire("Error", error.message, "error");
    }
}

async function deleteEvent(eventId) {
    if (!eventId || eventId === "undefined") {
        Swal.fire("Error", "Invalid event ID.", "error");
        return;
    }

    const result = await Swal.fire({
        title: "Delete Event?",
        text: "This will remove the event and all registrations.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Delete"
    });

    if (result.isConfirmed) {
        try {
            const { error } = await _supabase.from("events").delete().eq("id", eventId);
            if (error) throw error;
            Swal.fire("Deleted", "Event has been removed.", "success");
            fetchEvents();
        } catch (error) {
            Swal.fire("Error", error.message, "error");
        }
    }
}

function filterEvents(type, btnElement) {
    currentFilter = type;

    document.querySelectorAll(".event-filter-btn").forEach(btn => {
        btn.classList.remove("btn-info");
        btn.classList.add("btn-outline-info");
    });

    if (btnElement) {
        btnElement.classList.remove("btn-outline-info");
        btnElement.classList.add("btn-info");
    }

    fetchEvents();
}

function searchEvents() {
    const query = document.getElementById("searchEventInput") ? document.getElementById("searchEventInput").value.toLowerCase() : "";
    const cards = document.querySelectorAll(".event-card-item");

    cards.forEach((card) => {
        const title = card.querySelector(".event-title")?.innerText.toLowerCase() || "";
        const desc = card.querySelector(".event-description")?.innerText.toLowerCase() || "";

        if (title.includes(query) || desc.includes(query)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}
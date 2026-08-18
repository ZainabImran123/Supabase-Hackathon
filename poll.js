let currentUser = null;

// Supabase URL and Anon Key
const SUPABASE_URL = "https://xswkxjymswnveppratwx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzd2t4anltc3dudmVwcHJhdHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTQ5NTYsImV4cCI6MjEwMjM3MDk1Nn0.sOZhMZMfIBXKn9QgcPLUz9rmpwlHfNE52Bu8RBXIki0";

// Check if credentials are provided
if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT_REF") || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")) {
    console.error("Supabase Setup Missing: Please paste your real SUPABASE_URL and SUPABASE_ANON_KEY in poll.js");
}

// Initialize Supabase Client safely
let _supabase = null;
try {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
} catch (err) {
    console.error("Failed to initialize Supabase client:", err.message);
}

document.addEventListener("DOMContentLoaded", async () => {
    if (_supabase) {
        await initAuth();
        fetchPolls();
    }
});

/**
 * Initialize session and listen for auth state changes
 */
async function initAuth() {
    try {
        const { data: { session }, error } = await _supabase.auth.getSession();
        if (error) console.error("Error retrieving session:", error);

        currentUser = session ? session.user : null;
        updateAuthUI();

        _supabase.auth.onAuthStateChange((event, session) => {
            currentUser = session ? session.user : null;

            // Problem 1 Fixed: Auto-redirect to index.html on logout/session expiry
            if (event === "SIGNED_OUT" || !session) {
                window.location.href = "index.html";
                return;
            }

            updateAuthUI();
            fetchPolls();
        });
    } catch (err) {
        console.error("Auth init error:", err);
    }
}

/**
 * Update Navbar UI based on session
 */
function updateAuthUI() {
    const container = document.getElementById("authNavContainer");
    if (!container) return;

    if (currentUser) {
        // Problem 2 Fixed: Show display name (from metadata or email username) instead of full email
        const metadataName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name;
        const emailFallback = currentUser.email ? currentUser.email.split("@")[0] : "User";
        const displayName = metadataName || emailFallback;

        container.innerHTML = `
      <span class="text-light small me-3 fw-bold">
        <i class="fa-solid fa-circle-user me-1" style="color: var(--accent-blue);"></i>${displayName}
      </span>
      <button class="btn btn-outline-danger btn-sm" onclick="logout()">
        <i class="fa-solid fa-right-from-bracket me-1"></i>Logout
      </button>
    `;
    } else {
        container.innerHTML = `
      <a href="login.html" class="btn btn-sm btn-outline-info">
        <i class="fa-solid fa-right-to-bracket me-1"></i>Log In
      </a>
    `;
    }
}

/**
 * Logout User and redirect to index.html
 */
async function logout() {
    if (!_supabase) return;
    const { error } = await _supabase.auth.signOut();
    if (error) {
        Swal.fire("Error", error.message, "error");
    } else {
        // Problem 1 Fixed: Redirect to index.html on manual logout click
        window.location.href = "index.html";
    }
}

/**
 * Add Option Input Field
 */
function addOptionInput() {
    const wrapper = document.getElementById("optionsWrapper");
    if (!wrapper) return;
    const count = wrapper.children.length + 1;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control mb-2 poll-option-input";
    input.placeholder = `Option ${count}`;
    wrapper.appendChild(input);
}

/**
 * Create Poll
 */
async function createPoll() {
    if (!_supabase) {
        Swal.fire("Configuration Error", "Please add your real Supabase credentials to poll.js", "error");
        return;
    }

    const { data: { session } } = await _supabase.auth.getSession();
    const activeUserId = session?.user?.id || currentUser?.id || "00000000-0000-0000-0000-000000000000";

    const questionInput = document.getElementById("pollQuestion");
    const question = questionInput?.value.trim();
    const optionInputs = document.querySelectorAll(".poll-option-input");
    const options = Array.from(optionInputs).map(i => i.value.trim()).filter(v => v !== "");

    if (!question || options.length < 2) {
        Swal.fire("Invalid Input", "Please enter a question and at least two options.", "warning");
        return;
    }

    try {
        const { data: poll, error: pollErr } = await _supabase
            .from("polls")
            .insert([{ question, created_by: activeUserId }])
            .select()
            .single();

        if (pollErr) throw pollErr;

        const optionsPayload = options.map(opt => ({
            poll_id: poll.id,
            option_text: opt
        }));

        const { error: optErr } = await _supabase.from("poll_options").insert(optionsPayload);
        if (optErr) throw optErr;

        Swal.fire("Success!", "Poll created successfully.", "success");

        questionInput.value = "";
        document.getElementById("optionsWrapper").innerHTML = `
      <input type="text" class="form-control mb-2 poll-option-input" placeholder="Option 1 (e.g. React)">
      <input type="text" class="form-control mb-2 poll-option-input" placeholder="Option 2 (e.g. Vue)">
    `;

        fetchPolls();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}

/**
 * Fetch and Render Polls
 */
async function fetchPolls() {
    const container = document.getElementById("pollsFeedContainer");
    if (!container || !_supabase) return;

    try {
        const { data: polls } = await _supabase.from("polls").select("*").order("created_at", { ascending: false });
        const { data: options } = await _supabase.from("poll_options").select("*");
        const { data: votes } = await _supabase.from("poll_votes").select("*");

        container.innerHTML = "";

        if (!polls || polls.length === 0) {
            container.innerHTML = '<div class="text-muted text-center py-4">No active polls available yet. Create one above!</div>';
            return;
        }

        polls.forEach(poll => {
            const pollOptions = options ? options.filter(o => o.poll_id === poll.id) : [];
            const pollVotes = votes ? votes.filter(v => v.poll_id === poll.id) : [];
            const totalVotes = pollVotes.length;

            const userVote = pollVotes.find(v => v.user_id === currentUser?.id);

            const card = document.createElement("div");
            card.className = "card poll-card p-4 mb-4";

            let optionsHTML = "";

            pollOptions.forEach(opt => {
                const optionVotes = pollVotes.filter(v => v.option_id === opt.id).length;
                const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                const isSelected = userVote?.option_id === opt.id;

                if (userVote) {
                    optionsHTML += `
            <div class="mb-3">
              <div class="d-flex justify-content-between small mb-1">
                <span class="${isSelected ? 'poll-voted-badge' : 'text-light'}">
                  ${opt.option_text} ${isSelected ? '<i class="fa-solid fa-circle-check ms-1"></i>' : ''}
                </span>
                <span class="poll-percent-label">${percentage}% (${optionVotes})</span>
              </div>
              <div class="poll-progress-track">
                <div class="poll-progress-fill ${isSelected ? 'active' : 'secondary'}" style="width: ${percentage}%"></div>
              </div>
            </div>
          `;
                } else {
                    optionsHTML += `
            <button class="poll-option-btn mb-2" onclick="castVote('${poll.id}', '${opt.id}')">
              ${opt.option_text}
            </button>
          `;
                }
            });

            card.innerHTML = `
        <h5 class="poll-title mb-3">${poll.question}</h5>
        <div>${optionsHTML}</div>
        <small class="text-muted mt-2 d-block">
          <i class="fa-solid fa-users me-1"></i>Total Votes: ${totalVotes}
        </small>
      `;

            container.appendChild(card);
        });
    } catch (err) {
        console.error("Error fetching polls:", err);
    }
}

/**
 * Cast Vote
 */
async function castVote(pollId, optionId) {
    if (!_supabase) return;

    const { data: { session } } = await _supabase.auth.getSession();
    const activeUserId = session?.user?.id || currentUser?.id || "00000000-0000-0000-0000-000000000000";

    try {
        const { error } = await _supabase.from("poll_votes").insert([
            { poll_id: pollId, option_id: optionId, user_id: activeUserId }
        ]);

        if (error) {
            if (error.code === "23505") {
                Swal.fire("Already Voted", "You have already cast your vote on this poll.", "info");
            } else {
                throw error;
            }
            return;
        }

        Swal.fire("Vote Saved!", "Your response has been registered.", "success");
        fetchPolls();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
}
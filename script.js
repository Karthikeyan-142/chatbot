// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, onSnapshot, orderBy, serverTimestamp, getDocs, writeBatch, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM Elements ---
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatContainer = document.getElementById('chat-container');
const welcomeMessage = document.getElementById('welcome-message');
const newChatBtn = document.getElementById('new-chat-btn');
const authContainer = document.getElementById('auth-container');
const chatHistoryContainer = document.getElementById('chat-history-container');
const searchInput = document.getElementById('search-input');
const renameModalOverlay = document.getElementById('rename-modal-overlay');
const renameModal = document.getElementById('rename-modal');
const renameInput = document.getElementById('rename-input');
const saveRenameBtn = document.getElementById('save-rename-btn');
const cancelRenameBtn = document.getElementById('cancel-rename-btn');
const sidebar = document.getElementById('sidebar');
const shareModalOverlay = document.getElementById('share-modal-overlay');
const shareModal = document.getElementById('share-modal');
const createLinkBtn = document.getElementById('create-link-btn');
const shareInitialView = document.getElementById('share-initial-view');
const shareLinkView = document.getElementById('share-link-view');
const shareUrlInput = document.getElementById('share-url-input');
const copyLinkBtn = document.getElementById('copy-link-btn');
const closeShareBtn = document.getElementById('close-share-btn');


// --- App State ---
let currentChatId = null;
let chatToRenameId = null;
let chatToShareId = null;
let localChatHistory = [];
let unsubscribeChatHistory = () => {};
let unsubscribeMessages = () => {};

// --- Firebase Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyBlo13p2SUXph4fwF3m_wvXAkE0HM7xGIg",
    authDomain: "chatbo-2014d.firebaseapp.com",
    projectId: "chatbo-2014d",
    storageBucket: "chatbo-2014d.firebasestorage.app",
    messagingSenderId: "793779323536",
    appId: "1:793779323536:web:ad49a8b96319fb468b4e15"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();


// --- Page Load Logic ---
const urlParams = new URLSearchParams(window.location.search);
const publicChatId = urlParams.get('id');

if (publicChatId) {
    loadPublicChat(publicChatId);
} else {
    onAuthStateChanged(auth, user => {
        renderAuthState(user);
        if (user && !user.isAnonymous) {
            listenForChatHistory(user.uid);
        } else {
            if (unsubscribeChatHistory) unsubscribeChatHistory();
            chatHistoryContainer.innerHTML = '<p class="text-gray-500 text-sm px-2">Log in to see history.</p>';
        }
    });

    if (!auth.currentUser) {
        signInAnonymously(auth).catch(error => console.error("Anonymous sign-in failed:", error));
    }
}


// --- Authentication Logic ---
function renderAuthState(user) {
    authContainer.innerHTML = '';
    if (user && !user.isAnonymous) {
        authContainer.innerHTML = `
            <div class="flex items-center p-2 rounded-lg">
                <img src="${user.photoURL}" alt="User" class="w-8 h-8 rounded-full mr-3">
                <span class="font-medium truncate">${user.displayName}</span>
            </div>
            <button id="logout-btn" class="w-full text-left flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors duration-200">
                <i class="fas fa-sign-out-alt mr-2 w-4 text-center"></i>
                <span>Log out</span>
            </button>
        `;
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
    } else {
        authContainer.innerHTML = `
            <button id="login-btn" class="w-full text-left flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors duration-200">
                <i class="fab fa-google mr-2 w-4 text-center"></i>
                <span>Log in with Google</span>
            </button>
        `;
        document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
    }
}

// --- Firestore Logic ---
function listenForChatHistory(userId) {
    const chatsRef = collection(db, 'users', userId, 'chats');
    const q = query(chatsRef, orderBy('createdAt', 'desc'));

    unsubscribeChatHistory = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            chatHistoryContainer.innerHTML = '<p class="text-gray-500 text-sm px-2">No history yet.</p>';
            return;
        }
        chatHistoryContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            const chat = docSnap.data();
            
            const container = document.createElement('div');
            container.className = 'history-item-container';

            const titleBtn = document.createElement('button');
            titleBtn.className = 'history-title-btn';
            titleBtn.textContent = chat.title || 'Untitled Chat';
            titleBtn.addEventListener('click', () => loadChat(docSnap.id));

            const menuBtn = document.createElement('button');
            menuBtn.className = 'history-menu-btn';
            menuBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';

            const dropdownMenu = document.createElement('div');
            dropdownMenu.className = 'history-dropdown-menu';

            const renameBtn = document.createElement('button');
            renameBtn.className = 'dropdown-item';
            renameBtn.innerHTML = '<i class="fas fa-pencil-alt fa-fw"></i> Rename';
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showRenameModal(docSnap.id, chat.title);
                dropdownMenu.classList.remove('visible');
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'dropdown-item';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt fa-fw"></i> Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteChat(docSnap.id);
                dropdownMenu.classList.remove('visible');
            });
            
            const shareBtn = document.createElement('button');
            shareBtn.className = 'dropdown-item';
            shareBtn.innerHTML = '<i class="fas fa-share-alt fa-fw"></i> Share';
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                shareChat(docSnap.id);
                dropdownMenu.classList.remove('visible');
            });

            dropdownMenu.appendChild(renameBtn);
            dropdownMenu.appendChild(deleteBtn);
            dropdownMenu.appendChild(shareBtn);

            container.appendChild(titleBtn);
            container.appendChild(menuBtn);
            container.appendChild(dropdownMenu);
            chatHistoryContainer.appendChild(container);
            
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other dropdowns before opening this one
                document.querySelectorAll('.history-dropdown-menu').forEach(menu => {
                    if (menu !== dropdownMenu) {
                        menu.classList.remove('visible');
                    }
                });
                // Toggle the visibility of the current dropdown
                dropdownMenu.classList.toggle('visible');
            });
        });
    });
}

async function deleteChat(chatId) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;

    if (!confirm('Are you sure you want to delete this chat permanently?')) {
        return;
    }

    if (currentChatId === chatId) {
        currentChatId = null;
        localChatHistory = [];
        chatContainer.innerHTML = '';
        const welcome = document.getElementById('welcome-message');
        if (welcome) {
            const welcomeClone = welcome.cloneNode(true);
            welcomeClone.style.display = 'flex';
            chatContainer.appendChild(welcomeClone);
        }
    }

    try {
        const messagesRef = collection(db, 'users', user.uid, 'chats', chatId, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        const batch = writeBatch(db);
        messagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
        await deleteDoc(chatRef);
    } catch (error) {
        console.error("Error deleting chat:", error);
    }
}


async function createNewChat() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
        showCustomAlert('Please log in to create and save new chats.');
        return;
    };

    const chatsRef = collection(db, 'users', user.uid, 'chats');
    try {
        const newChatRef = await addDoc(chatsRef, {
            title: 'New Chat',
            createdAt: serverTimestamp()
        });
        loadChat(newChatRef.id);
    } catch (error) {
        console.error("Error creating new chat:", error);
    }
}

function loadChat(chatId) {
    if (currentChatId === chatId) return;
    
    currentChatId = chatId;
    localChatHistory = [];
    chatContainer.innerHTML = ''; 
    
    if(unsubscribeMessages) unsubscribeMessages(); 
    const messagesRef = collection(db, 'users', auth.currentUser.uid, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt'));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        localChatHistory = [];
        chatContainer.innerHTML = '';
        const welcome = document.getElementById('welcome-message');
        if (snapshot.empty && welcome) {
             chatContainer.appendChild(welcome.cloneNode(true));
        }
        snapshot.forEach(doc => {
            const message = doc.data();
            localChatHistory.push({ role: message.role, parts: [{ text: message.text }] });
            addMessageToUI(message.text, message.role);
        });
    });
}

async function saveMessage(chatId, role, text) {
    const user = auth.currentUser;
    if (!user || !chatId || user.isAnonymous) return;

    const messagesRef = collection(db, 'users', user.uid, 'chats', chatId, 'messages');
    await addDoc(messagesRef, {
        role,
        text,
        createdAt: serverTimestamp()
    });
     if (localChatHistory.length === 1 && role === 'user') { 
        const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
        await setDoc(chatRef, { title: text.substring(0, 30) }, { merge: true });
    }
}

async function loadPublicChat(publicId) {
    sidebar.style.display = 'none';
    const mainContent = document.querySelector('.flex-1.flex.flex-col');
    if (mainContent) {
        mainContent.style.width = '100vw';
    }
    const inputArea = document.querySelector('.w-full.max-w-3xl.mx-auto');
    if (inputArea) {
        inputArea.style.display = 'none';
    }
    
    try {
        const publicChatRef = doc(db, 'publicChats', publicId);
        const publicChatSnap = await getDoc(publicChatRef);

        if (publicChatSnap.exists()) {
            const chatData = publicChatSnap.data();
            const titleHeader = document.createElement('h1');
            titleHeader.textContent = `${chatData.title}`;
            titleHeader.className = 'text-2xl font-bold text-center p-4 border-b border-gray-700 w-full';
            
            const mainElement = document.querySelector('main');
            mainElement.prepend(titleHeader);


            chatContainer.innerHTML = '';
            chatData.messages.forEach(message => {
                addMessageToUI(message.text, message.role);
            });
        } else {
            chatContainer.innerHTML = '<p class="text-center text-red-500 mt-10">Shared chat not found or has been deleted.</p>';
        }
    } catch (error) {
        console.error("Error loading public chat:", error);
        chatContainer.innerHTML = '<p class="text-center text-red-500 mt-10">Could not load shared chat.</p>';
    }
}


// --- Modal Logic ---
function showRenameModal(chatId, currentTitle) {
    chatToRenameId = chatId;
    renameInput.value = currentTitle;
    renameModal.classList.remove('hidden');
    renameModalOverlay.classList.remove('hidden');
    renameInput.focus();
}

function hideRenameModal() {
    renameModal.classList.add('hidden');
    renameModalOverlay.classList.add('hidden');
    chatToRenameId = null;
}

async function handleSaveRename() {
    const newTitle = renameInput.value.trim();
    if (newTitle && chatToRenameId) {
        const user = auth.currentUser;
        if (user && !user.isAnonymous) {
            const chatRef = doc(db, 'users', user.uid, 'chats', chatToRenameId);
            try {
                await updateDoc(chatRef, { title: newTitle });
            } catch (error) {
                console.error("Error updating chat title:", error);
            }
        }
    }
    hideRenameModal();
}

function shareChat(chatId) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
        showCustomAlert('Please log in to share chats.');
        return;
    }
    chatToShareId = chatId;
    shareInitialView.classList.remove('hidden');
    shareLinkView.classList.add('hidden');
    shareUrlInput.value = '';
    shareModal.classList.remove('hidden');
    shareModalOverlay.classList.remove('hidden');
}

function hideShareModal() {
    shareModal.classList.add('hidden');
    shareModalOverlay.classList.add('hidden');
    chatToShareId = null;
}

async function handleCreateShareLink() {
    if (!chatToShareId) return;
    const user = auth.currentUser;

    createLinkBtn.disabled = true;
    createLinkBtn.textContent = 'Creating...';

    try {
        const messagesRef = collection(db, 'users', user.uid, 'chats', chatToShareId, 'messages');
        const q = query(messagesRef, orderBy('createdAt'));
        const messagesSnapshot = await getDocs(q);
        const messages = [];
        messagesSnapshot.forEach(doc => messages.push(doc.data()));

        const chatRef = doc(db, 'users', user.uid, 'chats', chatToShareId);
        const chatSnap = await getDoc(chatRef);
        const title = chatSnap.exists() ? chatSnap.data().title : 'Untitled Chat';

        const publicChatsRef = collection(db, 'publicChats');
        const newPublicChatRef = await addDoc(publicChatsRef, {
            title,
            messages,
            createdAt: serverTimestamp(),
            originalOwner: user.uid
        });

        const shareUrl = `${window.location.origin}${window.location.pathname}?id=${newPublicChatRef.id}`;
        
        shareUrlInput.value = shareUrl;
        shareInitialView.classList.add('hidden');
        shareLinkView.classList.remove('hidden');
    } catch (error) {
        console.error("Error creating share link:", error);
        showCustomAlert('Could not create share link.');
        hideShareModal();
    } finally {
        createLinkBtn.disabled = false;
        createLinkBtn.textContent = 'Create Link';
    }
}

function copyShareLink() {
    shareUrlInput.select();
    shareUrlInput.setSelectionRange(0, 99999);
    try {
        document.execCommand('copy');
        showCustomAlert('Link copied to clipboard!', 'success');
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showCustomAlert('Could not copy link.');
    }
}


// --- Event Listeners ---
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserMessage();
});

newChatBtn.addEventListener('click', () => {
     if (auth.currentUser && !auth.currentUser.isAnonymous) {
        createNewChat();
    } else {
        createNewChat();
    }
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserMessage();
    }
});

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
});

searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const chatItems = document.querySelectorAll('.history-item-container');
    chatItems.forEach(item => {
        const title = item.querySelector('.history-title-btn').textContent.toLowerCase();
        if (title.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// Modal event listeners
saveRenameBtn.addEventListener('click', handleSaveRename);
cancelRenameBtn.addEventListener('click', hideRenameModal);
renameModalOverlay.addEventListener('click', hideRenameModal);
renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveRename();
});

createLinkBtn.addEventListener('click', handleCreateShareLink);
copyLinkBtn.addEventListener('click', copyShareLink);
closeShareBtn.addEventListener('click', hideShareModal);
shareModalOverlay.addEventListener('click', hideShareModal);


// Close dropdowns if clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.history-dropdown-menu').forEach(menu => {
        menu.classList.remove('visible');
    });
});

// --- Core Chat Functions ---
const handleUserMessage = async () => {
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    if (!auth.currentUser || auth.currentUser.isAnonymous) {
         addMessageToUI(userMessage, 'user');
         localChatHistory.push({ role: "user", parts: [{ text: userMessage }] });
    } 
    else {
        if (!currentChatId) {
            await createNewChat();
        }
        addMessageToUI(userMessage, 'user');
        localChatHistory.push({ role: "user", parts: [{ text: userMessage }] });
        await saveMessage(currentChatId, 'user', userMessage);
    }

    messageInput.value = '';
    messageInput.style.height = 'auto';
    setFormDisabled(true);

    showTypingIndicator();
    getGeminiResponse();
};

const getGeminiResponse = async (retryCount = 0) => {
    const apiKey = "AIzaSyBrr-KqUrq4v5jaE6CpoSfxwsOnQDRb1yE"; 
    
    const systemInstruction = {
        role: "system",
        parts: [{ text: "Provide concise, easy-to-read answers. Use bullet points for lists or when it improves clarity. Keep responses to a few sentences unless the user asks for a detailed explanation." }]
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = { 
        contents: localChatHistory,
        systemInstruction: systemInstruction 
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            if (response.status === 429 && retryCount < 3) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.warn(`Rate limited. Retrying in ${delay}ms...`);
                setTimeout(() => getGeminiResponse(retryCount + 1), delay);
                return;
            }
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (botResponse) {
            addMessageToUI(botResponse, 'model');
            localChatHistory.push({ role: "model", parts: [{ text: botResponse }] });
            if (currentChatId && auth.currentUser && !auth.currentUser.isAnonymous) {
                await saveMessage(currentChatId, 'model', botResponse);
            }
        } else {
            throw new Error("Received an empty response from the API.");
        }
    } catch (error) {
        console.error("Gemini API Error:", error);
        addMessageToUI(`Sorry, something went wrong. Please check the console for details. Error: ${error.message}`, 'error');
    } finally {
        removeTypingIndicator();
        setFormDisabled(false);
        messageInput.focus();
    }
};

// --- UI Helper Functions ---
function addMessageToUI(message, sender) {
    const welcome = document.getElementById('welcome-message');
    if(welcome) welcome.style.display = 'none';

    const messageWrapper = document.createElement('div');
    messageWrapper.className = `flex w-full items-start gap-3 ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    if (sender === 'error') {
        bubble.style.backgroundColor = '#7f1d1d';
        bubble.style.color = '#fecaca';
        bubble.textContent = message;
    } else {
        const proseContainer = document.createElement('div');
        proseContainer.className = 'prose prose-invert max-w-none';
        proseContainer.innerHTML = marked.parse(message);
        bubble.appendChild(proseContainer);
    }
    
    if(sender === 'user') {
         messageWrapper.classList.add('user-message');
    } else {
         messageWrapper.classList.add('bot-message');
    }
    
    messageWrapper.appendChild(bubble);
    chatContainer.appendChild(messageWrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator() {
    const indicatorElement = document.createElement('div');
    indicatorElement.id = 'typing-indicator';
    indicatorElement.className = 'flex justify-start items-start gap-3 bot-message';
    indicatorElement.innerHTML = `<div class="chat-bubble flex items-center gap-1 p-3">
        <span class="typing-indicator"><span></span><span></span><span></span></span>
    </div>`;
    chatContainer.appendChild(indicatorElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function setFormDisabled(disabled) {
    messageInput.disabled = disabled;
    sendButton.disabled = disabled;
    sendButton.classList.toggle('cursor-not-allowed', disabled);
}

function showCustomAlert(message, type = 'error') {
    const alert = document.createElement('div');
    const bgColor = type === 'success' ? '#22c55e' : '#ef4444';
    alert.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: ${bgColor}; color: white; padding: 12px 24px; border-radius: 8px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);`;
    alert.textContent = message;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
}


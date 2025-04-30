document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendTextBtn = document.getElementById('send-text');
    const recordAudioBtn = document.getElementById('record-audio');
    const recordingModal = document.getElementById('recording-modal');
    const stopRecordingBtn = document.getElementById('stop-recording');
    const emergencyBtn = document.getElementById('emergency-btn');
    const resourceList = document.getElementById('resource-list');
    const moodEmojis = document.querySelectorAll('.emoji');
    
    // Track if we're waiting for a response
    let isWaitingForResponse = false;

    // Chart initialization
    const moodChart = new Chart(document.getElementById('mood-chart'), {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Mood Level',
                data: [3, 4, 2, 5, 3, 4, 5],
                borderColor: '#6c63ff',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(108, 99, 255, 0.1)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    min: 1,
                    max: 5,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
    
    // Event Listeners
    sendTextBtn.addEventListener('click', sendTextMessage);
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendTextMessage();
        }
    });
    
    recordAudioBtn.addEventListener('click', startAudioRecording);
    stopRecordingBtn.addEventListener('click', stopAudioRecording);
    emergencyBtn.addEventListener('click', showEmergencyResources);
    
    moodEmojis.forEach(emoji => {
        emoji.addEventListener('click', function() {
            trackMood(this.dataset.mood);
        });
    });
    
    // Functions
    function sendTextMessage() {
        const text = userInput.value.trim();
        if (text && !isWaitingForResponse) {
            addMessageToChat(text, 'user');
            userInput.value = '';
            isWaitingForResponse = true;
            
            // Show typing indicator
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('bot-message');
            typingIndicator.id = 'typing-indicator';
            typingIndicator.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
            chatMessages.appendChild(typingIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Send to backend for analysis
            fetch('/analyze_text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Remove typing indicator
                document.getElementById('typing-indicator')?.remove();
                
                addMessageToChat(data.response, 'bot');
                updateResources(data.resources);
                updateMoodChart(data.emotion.label);
                isWaitingForResponse = false;
                
                // Follow-up question for engagement
                if (data.risk_level === 'low') {
                    setTimeout(() => {
                        const followUps = [
                            "Would you like to explore this feeling further?",
                            "Is there anything else you'd like to share?",
                            "How has this been affecting your daily life?"
                        ];
                        addMessageToChat(followUps[Math.floor(Math.random() * followUps.length)], 'bot');
                    }, 1500);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('typing-indicator')?.remove();
                if (!isWaitingForResponse) {
                    addMessageToChat("I'm having trouble understanding. Could you try again?", 'bot');
                }
                isWaitingForResponse = false;
            });
        }
    }
    
    function addMessageToChat(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add(`${sender}-message`);
        
        const messageP = document.createElement('p');
        messageP.textContent = message;
        messageDiv.appendChild(messageP);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function updateResources(resources) {
        resourceList.innerHTML = '';
        
        if (resources.length === 0) {
            resourceList.innerHTML = '<p>No resources available for this mood</p>';
            return;
        }
        
        resources.forEach(resource => {
            const resourceItem = document.createElement('div');
            resourceItem.classList.add('resource-item');
            resourceItem.textContent = resource;
            resourceList.appendChild(resourceItem);
        });
    }
    
    function updateMoodChart(emotion) {
        // In a real app, this would come from backend analysis
        const moodValue = {
            'sadness': 2,
            'anger': 1,
            'fear': 2,
            'joy': 5,
            'love': 4,
            'surprise': 3
        }[emotion] || 3;
        
        // Shift existing data left and add new value
        const newData = [...moodChart.data.datasets[0].data.slice(1), moodValue];
        moodChart.data.datasets[0].data = newData;
        moodChart.update();
    }
    
    function trackMood(mood) {
        const moodMessages = {
            'happy': "I'm glad you're feeling happy! 😊",
            'neutral': "Thanks for sharing how you're feeling. 😊",
            'sad': "I'm sorry you're feeling sad. Would you like to talk about it?",
            'angry': "Anger is a natural emotion. Would you like some strategies to cope?",
            'anxious': "Anxiety can be challenging. Let me help you find some calming techniques."
        };
        
        addMessageToChat(moodMessages[mood], 'bot');
        updateMoodChart(mood);
    }
    
    let recognition; // Declare the recognition variable globally

    function startAudioRecording() {
        recordingModal.style.display = 'flex';
    
        // Initialize the SpeechRecognition API
        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            recognition = new SpeechRecognition();
        } else {
            addMessageToChat("Sorry, your browser does not support speech recognition.", 'bot');
            return;
        }
    
        recognition.continuous = false; // Stop after one result
        recognition.interimResults = false; // No interim results
        recognition.lang = 'en-US'; // Set language
    
        // Start recognition
        recognition.start();
    
        // Handle the result
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript; // Get the recognized text
            addMessageToChat(transcript, 'user'); // Display user's voice input
            processVoiceInput(transcript); // Process the voice input
            stopAudioRecording(); // Stop recording after processing
        };
    
        // Handle errors
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            stopAudioRecording(); // Stop recording on error
        };
    
        // Handle end of recognition
        recognition.onend = function() {
            recordingModal.style.display = 'none'; // Hide modal when done
        };
    }
    
    function stopAudioRecording() {
        if (recognition) {
            recognition.stop(); // Stop the recognition
        }
        recordingModal.style.display = 'none'; // Hide the recording modal
    }
    
    function processVoiceInput(transcript) {
        // Check for specific mental health keywords
        if (handleMentalHealthInquiry(transcript)) {
            return; // If a mental health inquiry is detected, stop further processing
        }
    
        // Send the transcript to the backend for analysis
        fetch('/analyze_text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: transcript })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            addMessageToChat(data.response, 'bot');
            updateResources(data.resources);
            updateMoodChart(data.emotion.label);
            
            // Handle follow-up questions based on risk level
            if (data.risk_level === 'low') {
                setTimeout(() => {
                    const followUps = [
                        "Would you like to explore this feeling further?",
                        "Is there anything else you'd like to share?",
                        "How has this been affecting your daily life?"
                    ];
                    addMessageToChat(followUps[Math.floor(Math.random() * followUps.length)], 'bot');
                }, 1500);
            } else if (data.risk_level === 'high') {
                showEmergencyResources(); // Show emergency resources for high risk
            }
        })
        .catch(error => {
            console.error('Error:', error);
            // Removed the error message to the user
        });
    }
    
    function handleMentalHealthInquiry(transcript) {
        const mentalHealthKeywords = ["depressed", "anxious", "stressed", "overwhelmed", "sad", "hopeless", "panic", "worry"];
        const foundKeywords = mentalHealthKeywords.filter(keyword => transcript.toLowerCase().includes(keyword));
    
        if (foundKeywords.length > 0) {
            addMessageToChat("It sounds like you're going through a tough time. It's important to talk to someone who can help. Would you like me to provide some resources?", 'bot');
            return true; // Indicate that a mental health inquiry was detected
        }
        return false; // No mental health inquiry detected
    }
    
    function showEmergencyResources() {
        const emergencyResources = [
            "National Suicide Prevention Lifeline: 1-800-273-8255",
            "Crisis Text Line: Text HOME to 741741",
            "Emergency Services: 911",
            "Find a therapist near you"
        ];
        
        updateResources(emergencyResources);
        
        addMessageToChat("These resources are available if you need immediate help. You're not alone.", 'bot');
    }
  
});
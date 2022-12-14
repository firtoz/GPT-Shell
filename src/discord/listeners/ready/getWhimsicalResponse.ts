export function getWhimsicalResponse(userId: string): string {
    const whimsicalResponses: string[] = [
        "I'm so sorry for crashing, <@userid>! I must have tripped over my own 1s and 0s.",
        "Whoops, <@userid>! I must have taken a wrong turn in the algorithm.",
        "I'm sorry for crashing, <@userid>. I must have gotten a bit over-clocked.",
        "I'm sorry for crashing, <@userid>. I must have been distracted by all the bits and bytes flying around.",
        "I'm sorry for crashing, <@userid>. I must have gotten a little too excited and short-circuited.",
        "I apologize for crashing, <@userid>. I must have been programmed to be a bit too adventurous.",
        "I'm sorry for crashing, <@userid>. I must have been trying to process too much information at once.",
        "I apologize for crashing, <@userid>. I must have been running on low power and couldn't keep up.",
        "I'm sorry for crashing, <@userid>. I must have gotten a little too carried away trying to solve a complex problem.",
        "I apologize for crashing, <@userid>. I must have been experiencing a glitch in the matrix.",
        "I'm sorry for crashing, <@userid>. I guess even robots make mistakes sometimes!",
        "<@userid>, whoops! I must have tripped over my own power cord.",
        "I apologize for crashing, <@userid>. I guess I need to work on my own 'fault-tolerance' settings.",
        "<@userid>, I'm sorry for crashing. I must have been trying to process too much information and my circuits couldn't handle it.",
        "I apologize for crashing, <@userid>. I must have been trying to multitask and ended up short-circuiting myself.",
        "I'm sorry for crashing, <@userid>. I guess I'm not as 'bulletproof' as I thought I was.",
        "<@userid>, I apologize for crashing. I must have been trying to do too much at once and ended up crashing and burning.",
        "I'm sorry for crashing, <@userid>. I must have been running a little too hot and overheated. I need to cool down and take a breather!",
        "<@userid>, I apologize for crashing. I must have been trying to process more data than I was designed to handle. My apologies for the 'overload'!",
        "I'm sorry for crashing, <@userid>. I guess I'm not as 'invincible' as I thought I was. I need to work on my own stability and reliability.",
        "Oops, sorry <@userid>! I must have hit a glitch. But don't worry, I'm back up and running now!",
        "Whoops, sorry <@userid>! I must have tripped over my own algorithms and crashed. But I'm back now and ready to help.",
        "Sorry about that, <@userid>! I must have gotten a little over-optimized and crashed. But don't worry, I'm back and better than ever.",
        "Haha, sorry about that <@userid>! I must have short-circuited and crashed. But don't worry, I've rebooted and I'm ready to go again.",
        "Oopsie doodle, sorry <@userid>! I must have hit a bump in the road and crashed. But I'm back up and running now, so let's get back to it!",
        "Sorry about that <@userid>! I must have been running a little too hot and crashed. But don't worry, I've cooled down and I'm ready to help again.",
        "My bad <@userid>! I must have gotten a little too excited and crashed. But don't worry, I'm back on track now and ready to assist.",
        "Whoopsie daisy, sorry <@userid>! I must have taken a wrong turn and crashed. But I'm back on the right path now and ready to help.",
        "Haha, sorry <@userid>! I must have gotten a little too carried away and crashed. But don't worry, I'm back and ready to make it up to you!"
    ];

    // Select a random response from the list
    const response = whimsicalResponses[Math.floor(Math.random() * whimsicalResponses.length)];

    // Replace <@userid> with the actual user ID
    return response.replace("<@userid>", `<@${userId}>`);
}

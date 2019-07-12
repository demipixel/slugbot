import cleverbotfree.cbfree
import sys
cb = cleverbotfree.cbfree.Cleverbot()

# Script to have a conversation with cleverbot.
# Requires cleverbotfree
# Install it through pip

def chat():
    counter = 0;
    try:
        cb.browser.get(cb.url)
    except:
        cb.browser.close()
        sys.exit()
    while True:
        try:
            cb.get_form()
        except:
            sys.exit()
        userInput = input()
        #counter = counter + 1;
        cb.send_input(userInput)
        bot = cb.get_response()
        print(bot)
    cb.browser.close()

chat()

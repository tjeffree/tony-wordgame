function wordGame(){}
(function(){

    // Private
    var 
        $win        = $(window),
        $doc        = $(document),
        $body       = $('body'),

        outputCheck = document.getElementById('output-check'),

        PADDING     = 20,           // padding for the bottom and right of the screen
        REFRESH     = 5 * 1000, // refresh interval to get new words

        TIME_LIMIT  = 60,           // Time limit for time limited game
        WORD_LIMIT  = 100,          // Word limit for word limited game

        // background colours for the words
        colList     = ["#ECD078","#D95B43","#C02942","#542437","#53777A","#003366","#FFCC00","#53004B","#77BED2","#F2583E"],
        colX        = 0,

        // Various DOM objects
        $typebox,
        $words,
        $score,
        $level,
        $wpm,
        $finish,

        getTO       = null,      // Timeout pointer for the word fetching
        timeTO      = null,      // Timeout pointer for the time limited game

        limit       = 10,        // Number of words to fetch
        count       = 0,         // Count of words being displayed at any one time
        running     = false,     // Status of the word fetching
        wordlist    = {},        // Object containing all words being displayed

        // wordnik API key
        api_key     = '740916580801827774344013e130d4be97817a950b357cc36',

        // wordnik options
        APIoptions  = {
            api_key             : api_key,
            hasDictionaryDef    : true,
            minLength           : 3,
            maxLength           : 7,
            minCorpusCount      : 100,
            minDictionaryCount  : 2
        },

        // Player's current level
        currentLevel    = 0,

        // Description of each level
        levels          = [
            { score: 10,    minLength : 3,  maxLength : 4,  timeout : 30    },
            { score: 25,    minLength : 4,  maxLength : 5,  timeout : 30    },
            { score: 50,    minLength : 4,  maxLength : 6,  timeout : 40    },
            { score: 80,    minLength : 5,  maxLength : 7,  timeout : 40    },
            { score: 120,   minLength : 5,  maxLength : 9,  timeout : 60    },
            { score: 150,   minLength : 5,  maxLength : 10, timeout : 60    },
            { score: 200,   minLength : 5,  maxLength : 12, timeout : 80    },
            { score: 300,   minLength : 5,  maxLength : 14, timeout : 80    },
            { score: null,  minLength : 10, maxLength : 15, timeout : 90    }
        ],
        
        // Key map
        KEY = {
            "ESC"   : 27,
            "ENTER" : 13,
            "SPACE" : 32,
            "BACKSP": 8
        }

        score           = 0,         // Current score
        characters      = 0,         // Current character count
        errors          = 0,         // Count of errors
        inerror         = false,     // Keep track of whether we are in a state of error
        lastKey         = null,      // Last key pressed

        // Track start and end timestamps
        startTime       = null,
        endTime         = null,

        // Game type - word/time limited, non-stop
        gametype        = null;

        // Public
        this.init = function() {

            // Fetch common DOM objects
            $words      = $('#worddisplay');
            $typebox    = $('#typebox').focus();
            $score      = $('#score');
            $level      = $('#level');
            $wpm        = $('#wpm');
            $finish     = $('#finish-dialog');

            setEvents();
            getWords();
        }

        // Sets all variables to their default state
        function reset() {
            clearTimeout(timeTO);

            doCol('#333', '#000');

            currentLevel= 0;
            score       = 0;
            characters  = 0;
            errors      = 0;
            startTime   = null;
            endTime     = null;
            gametype    = null;
            lastKey     = null;
//          running     = false;

            $typebox.val('').removeAttr('disabled').focus();
            $('#options-wrapper input').removeAttr('disabled','disabled');
            $score.html('0');
            $level.html('Lvl 1');
            $wpm.html('');
            $finish.hide();
            $words.removeClass('finish');
            $typebox.attr('placeholder','Start typing!');

            getWords();
        }

        function finish() {
            $typebox.attr('disabled','disabled');
//          count = 0;
//          $words.empty();
//          wordlist = {};
//          clearTimeout(getTO);

            var winHeight   = $doc.height(),
                winWidth    = $doc.width(),
                xPos        = (winWidth/2) - ($finish.width()/2),
                yPos        = (winHeight/2) - ($finish.height()/2),
                ts          = new Date().getTime() / 1000,
                diff        = ts - startTime;

            updateWPM();

            $words.addClass('finish');

            // Set up score board
            $('#f-score').html('Score: ' + score);
            $('#f-time').html(diff.toFixed() + ' sec');
            $('#f-wpm').html($wpm.html());
            if (errors > 0) {
                $('#f-errors').html(errors + ' error' + ( errors>1 ? 's': ''));
            } else {
                $('#f-errors').html('No errors');
            }

            $('#tweetBtn iframe').remove();
            var tweetLink = document.createElement('a');
            tweetLink.className = 'twitter-share-button';
            tweetLink.href = 'https://twitter.com/share';
            tweetLink.setAttribute('data-url', 'http://shex.co.uk/wordgame/');
            tweetLink.setAttribute('data-count', 'none');
            tweetLink.setAttribute('data-size', 'large');
            tweetLink.setAttribute('data-text', 'I scored ' + score + ' words in ' + diff.toFixed() + ' seconds on this Word Game. Give it a try!');

            document.getElementById('tweetBtn').innerHTML = '';
            document.getElementById('tweetBtn').appendChild(tweetLink);

            twttr.widgets.load();

            $finish.css({
                top: yPos,
                left: xPos
            }).show();
        }

        function getGameType() {
            gametype = $('#options-wrapper input:checked').data('type');

            if (gametype==='timed') {
                timeTO = setTimeout(function() {checkTimed();}, 10000);
            }

            $('#options-wrapper input').attr('disabled','disabled');
        }

        // Methods for finishing a game
        function checkTimed() {

            clearTimeout(timeTO);

            var refresh = 5000,
                diff    = ( Date.now() / 1000 ) - startTime;
                
            if (diff >= TIME_LIMIT) {
                finish();
            } else {
                if (diff >= TIME_LIMIT - 10000) {   // If within 10secs of finishing, check more often
                    refresh = 500;
                }
                timeTO = setTimeout(function() {checkTimed();}, refresh);
            }
        }

        function checkScore() {
            if (score>=WORD_LIMIT && gametype==='words') {
                finish();
            }
        }

        function setEvents() {

            $typebox
            
            .on('keydown', function(e) {
                    
                    // If the last key pressed was space then this was likely to delete the space (which didn't go in anyway)
                    // If this feels weird, take out this and the space checker above..
                    if (e.keyCode === KEY.BACKSP && lastKey === KEY.SPACE) {
                        e.preventDefault();
                        return false;
                    }
                })
            
            .on('keyup', function(e) {
                
                // To handle the same scenario as the keydown above
                if (e.keyCode === KEY.BACKSP && lastKey === KEY.SPACE) {
                    lastKey = e.keyCode;
                    return;
                }
                
                // Save people's sanity and allow ESC or Return/Enter to clear the typing box
                if (e.keyCode === KEY.ESC || e.keyCode === KEY.ENTER) {
                    $typebox.val('');
                    return;
                }
                
                // There are no spaces in the words, so just back up when space is hit
                if (e.keyCode === KEY.SPACE) {
                    $typebox.val(this.value.substring(0, this.value.length-1));
                    
                    lastKey = e.keyCode;
                    return;
                }
                
                // Nothing left in this input now
                if (this.value.length==0) {
                    doCol('#333', '#000');
                    return;
                }
                
                lastKey = e.keyCode;

                var str = this.value,
                    ts  = Date.now() / 1000,
                    wordMatches, wordPartFound = false, 
                    timedOut, removedTimedOut = false,
                    firstrun = false;

                if (startTime===null) {
                    startTime = ts;
                    firstrun  = true;
                    getGameType();
                }

                characters++;

                for (x in wordlist) {

                    // On the first run, reset the timestamps so words don't all vanish if it was left a while before starting
                    if (firstrun) {
                        wordlist[x].ts = ts;
                    }

                    // word matches
                    wordMatches     = wordlist[x].word.substring(0, str.length)===str,

                    // length matches
                    lengthMatches   = wordlist[x].word.length === str.length;

                    // word is past the timeout and is not currently being typed - get rid
                    timedOut        = !removedTimedOut && !wordMatches && (ts - wordlist[x].ts) > levels[currentLevel].timeout;

                    if ((wordMatches&&lengthMatches) || timedOut) {

                        // make sure we note this is found so we don't change the text colour
                        wordPartFound = true;

                        removeWord($('#w'+wordlist[x].id), x);

                        if (!timedOut) {
                            // empty the typing box
                            doCol('#333', '#000');
                            $typebox.val('');
                            incScore();
                        } else {
                            // remove just 1 word at a time of the timed-out variety
                            removedTimedOut = true;
                        }
                    } else if (wordPartFound===false) {
                        if (wordMatches) {
                            // Is matching a word
                            doCol('#2d2b4e', '#190eb5');

                            // Mark the part found for this keystroke
                            wordPartFound = true;

                            // Reset the timestamp on this word to stop it disappearing on a typo
                            wordlist[x].ts = ts;

                            // Push this word to the top to stop it getting hit by new words
                            $('#w'+wordlist[x].id).css({zIndex: 2});
                        }
                    }
                }

                if (wordPartFound===false) {
                    if (!inerror) {
                        errors++;
                        inerror = true;
                        doCol('#58282e', '#E0001E');
                    }
                } else {
                    inerror = false;
                }

                if (count < 5) {
                    getWords();
                }

            });

            $words.on('click', 'li', function() {

                var obj = $(this);
                removeWord(obj, obj.data('id'));

                $typebox.focus();

                // check how many we have left
                if (count < 5) {
                    getWords();
                }

            });

            $('#reset, #finish-button').click(function() {
                reset();
            })

            $('#wordnik a').click(function() {
                window.open(this.href);
                return false;
            })

            $('#loadit').click(function() {
                getWords();
            });

            window.onresize = function() {
                count = 0;
                $words.empty();
                wordlist = {};
                getTO = setTimeout(function(){getWords();}, 300);
            };
        }

        function removeWord(obj, id) {

            // remove this word
            obj.fadeOut(300).queue(function(){$(this).remove();});

            // decrement the count
            count--;

            // remove the word from the list
            delete wordlist[id];
        }

        function doCol(bg, txt) {
            $body.css({backgroundColor: bg});
            $typebox.css({color: txt});
        }

        function incScore() {

            // increment the score and update the display
            score++;
            $score.html(score).animate({color: '#fff047'}, 300).delay(100).animate({color: '#f1f1f1'}, 300);

            // On the first point, remove the placeholder text from the typing box
            if (score==1) {
                $typebox.removeAttr('placeholder');
            }

            // Check if we have gone up a level
            if (levels[currentLevel].score!=null && score >= levels[currentLevel].score) {
                currentLevel++;
                $level.html('Lvl ' + (currentLevel+1));
            }

            updateWPM();

            checkScore();
        }

        function updateWPM() {
            
            var mins = ( ( Date.now() / 1000 ) - startTime ) / 60;

            $wpm.html(Math.round(score / mins) + ' WPM');
        }

        function setWordTO() {
            getTO = setTimeout(function(){getWords();}, REFRESH);
        }

        function getWords() {

            if (running===true) {
                setWordTO();
                return;
            }

            clearTimeout(getTO);

            running = true;

            if (count===limit) {
                running = false;
                setWordTO();
                return;
            }

            APIoptions.limit        = limit - count + 5;        // Add on some extra so we complete the set quicker
            APIoptions.minLength    = levels[currentLevel].minLength;
            APIoptions.maxLength    = levels[currentLevel].maxLength;

            $.ajax(
                'http://api.wordnik.com/v4/words.json/randomWords',
                {
                    data: APIoptions,
                    dataType: 'jsonp'
                }
            ).done(function(data) {

                processWords(data);

            }).always(function() {
                setWordTO();
                running = false;

                setTimeout(function() {
                    $('.word').addClass('active');
                }, 10);

            });

        }

        function processWords(data) {
            var winHeight   = $doc.height() - 115,
                winWidth    = $doc.width(),
                ts          = Date.now() / 1000,
                htmlBank    = [],
                html, thisWord,
                xpos, ypos, bounds,
                heightMax, widthMax;

            for (var x=0; x<data.length; x++) {

                if (count>=10) break;

                // increment the current word count
                count++;

                if (!(/^[a-z]+$/i.test(data[x].word))) {
                    continue;
                }

                // add the word to the list
                wordlist[data[x].id] = {
                    id  : data[x].id,
                    word: data[x].word.toLowerCase(),
                    ts  : ts
                };

                html     = document.createElement('li');
                html.id = 'w' + data[x].id;
                html.setAttribute('data-id', data[x].id);

                thisWord = document.createElement('div');
                thisWord.className = 'word';
                thisWord.innerHTML = wordlist[data[x].id].word;
                thisWord.setAttribute('style', 'background-color: ' + colList[colX]);

                html.appendChild(thisWord);

                // Check width and make sure it's not off the screen
                outputCheck.appendChild(html);
                bounds = thisWord.getBoundingClientRect();
                outputCheck.removeChild(html);

                widthMax = winWidth - bounds.width;
                heightMax = winHeight - bounds.height;
                
                xpos = (Math.random() * widthMax).toFixed();
                ypos = (Math.random() * heightMax + 110).toFixed();

                html.setAttribute('style',
                    'left: ' + xpos + 'px; ' +
                    'top : ' + ypos + 'px'
                );

                htmlBank.push(html);

                colX++;
                if (colX==10) colX = 0;
            }

            // Add them in one big DOM append
            $words.append(htmlBank);
        }

}).apply(wordGame);


$(document).ready(function() {
    wordGame.init();
});

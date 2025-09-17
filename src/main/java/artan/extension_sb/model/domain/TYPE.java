package artan.extension_sb.model.domain;

public enum TYPE {
    DEFINE, // define the type of prompt with the tags below    --- FINISH
    INTERNAL, // something related to the ongoing conversation  --- FINISH
    EXTERNAL, // something related to general knowledge         --- FINISH
    VIDEO, // video summarization ()
    SUMMARIZATION, // webpage summarization ()                  --- FINISH
    TIME_DATE, // current time                                  --- FINISH
    WEATHER, // weather                                         --- FINISH
    WEATHER_RESULT, // fetch weather result (tied to WEATHER)   --- FINISH
    SEARCH, // search functionality on a website
    DOCUMENT
}

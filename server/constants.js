/*
Every symbol value returned from Symbol() is unique.
https://developer.mozilla.org/zh-TW/docs/Web/JavaScript/Reference/Global_Objects/Symbol

*/
const LogTypes = Object.freeze({
    CREATECOURSE: 'CREATECOURSE',
    JOINCOURSE: 'JOINCOURSE',
    CREATETASK: 'CREATETASK',
    SUBMITTASK: 'SUBMITTASK',
    LIKEAPOST: 'LIKEAPOST',
    UNLIKEAPOST: 'UNLIKEAPOST',
    USHOWAWARD: 'USHOWAWARD',

});

const NotificationTypes = Object.freeze({
    T_CREATECOURSE: 'T_CREATECOURSE',
    S_JOINCOURSE: 'S_JOINCOURSE',
    T_CREATETASK: 'T_CREATETASK',
    S_SUBMITTASK: 'S_SUBMITTASK',
    A_LIKEAPOST: 'A_LIKEAPOST',
    A_UNLIKEAPOST: 'A_UNLIKEAPOST',
    S_USHOWAWARD: 'S_USHOWAWARD',
    T_USHOWAWARD: 'T_USHOWAWARD',

});

module.exports = { LogTypes, NotificationTypes }

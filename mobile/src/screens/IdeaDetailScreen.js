import React, {
    useState,
    useEffect,
    useCallback,
    memo,
    useRef
} from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Image,
    Modal,
    Pressable,
    Dimensions,
    Linking,
} from "react-native";
import {
    SafeAreaView
} from "react-native-safe-area-context";
import {
    Ionicons
} from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Animated, {
    FadeIn,
    FadeInUp
} from "react-native-reanimated";
import MediaPicker from "../components/MediaPicker";
import AutocompleteMenu from "../components/AutocompleteMenu";
import BackgroundWrapper from "../components/BackgroundWrapper";
import GlassCard from "../components/GlassCard";
import Button from "../components/Button";
import LinkPreview from "../components/LinkPreview";
import {
    useAuth
} from "../context/AuthContext";
import {
    useTheme
} from "../context/ThemeContext";
import {
    useToast
} from "../context/ToastContext";
import {
    api
} from "../services/api";
import {
    joinIdea,
    leaveIdea,
    onSocketEvent
} from "../services/socket";

// Memoized invite form to prevent re-renders
const InviteForm = memo(({
    ideaId,
    colors,
    onClose,
    showToast
}) => {
    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);

    const handleInvite = async () => {
        if (!email.trim()) return;
        setSending(true);
        try {
            await api.post("/collaborators/invite", {
                ideaId,
                email: email.trim(),
                role: "contributor",
            });
            showToast("Invitation sent!", "success");
            setEmail("");
            onClose();
        } catch (error) {
            showToast(error.message || "Failed to send invitation", "error");
        } finally {
            setSending(false);
        }
    };

    return ( <
        Animated.View entering = {
            FadeIn.duration(200)
        }
        style = {
            styles.inviteSection
        } >
        <
        GlassCard >
        <
        Text style = {
            [
                styles.inviteTitle,
                {
                    color: colors.text,
                },
            ]
        } >
        Invite Collaborator <
        /Text> <
        TextInput style = {
            [
                styles.inviteInput,
                {
                    color: colors.text,
                    borderColor: colors.glassBorder,
                },
            ]
        }
        placeholder = "Enter email address"
        placeholderTextColor = {
            colors.textTertiary
        }
        value = {
            email
        }
        onChangeText = {
            setEmail
        }
        keyboardType = "email-address"
        autoCapitalize = "none" /
        >
        <
        Button title = "Send Invite"
        onPress = {
            handleInvite
        }
        loading = {
            sending
        }
        /> < /
        GlassCard > <
        /Animated.View>
    );
});

// BlurView for input container
const BlurView = Platform.OS !== "web" ? require("expo-blur").BlurView : View;

// Memoized reply composer to prevent re-renders
const ReplyComposer = memo(
    ({
        ideaId,
        colors,
        onReplySubmitted,
        showToast,
        onMediaPickerPress,
        emojiToInsert,
        onEmojiInserted,
        replyingTo,
        onCancelReply,
        editingReply,
        onCancelEdit,
        onSaveEdit
    }) => {
        const [content, setContent] = useState("");
        const [selectedFile, setSelectedFile] = useState(null);
        const [sending, setSending] = useState(false);
        const [autocompleteQuery, setAutocompleteQuery] = useState("");
        const [showAutocomplete, setShowAutocomplete] = useState(false);
        const fileInputRef = useRef(null);

        // Insert emoji when received from parent
        useEffect(() => {
            if (emojiToInsert) {
                setContent(prev => prev + emojiToInsert);
                onEmojiInserted?.();
            }
        }, [emojiToInsert, onEmojiInserted]);

        // Populate content when editing
        useEffect(() => {
            if (editingReply) {
                setContent(editingReply.content || "");
            } else {
                setContent("");
            }
        }, [editingReply]);

        // Detect :query pattern for autocomplete
        const handleContentChange = (text) => {
            setContent(text);
            
            // Find if there's an incomplete :query pattern
            const match = text.match(/:([a-zA-Z0-9_-]*)$/);
            if (match && match[1].length >= 1) {
                setAutocompleteQuery(match[1]);
                setShowAutocomplete(true);
            } else {
                setAutocompleteQuery("");
                setShowAutocomplete(false);
            }
        };

        // Handle emoji selection from autocomplete
        const handleAutocompleteSelect = (emoji, name) => {
            // Replace :query with the emoji
            const newContent = content.replace(/:([a-zA-Z0-9_-]*)$/, emoji);
            setContent(newContent);
            setShowAutocomplete(false);
            setAutocompleteQuery("");
        };

        // Handle sticker selection from autocomplete
        const handleAutocompleteStickerSelect = async (sticker) => {
            setShowAutocomplete(false);
            setAutocompleteQuery("");
            // Remove the :query from content
            const newContent = content.replace(/:([a-zA-Z0-9_-]*)$/, "").trim();
            setContent(newContent);
            
            // Send sticker as a reply
            try {
                await api.post("/replies", {
                    ideaId,
                    content: sticker.file_url,
                });
                onReplySubmitted();
            } catch (error) {
                showToast("Failed to send sticker", "error");
            }
        };

        const handleSendReply = async () => {
            if (!content.trim() && !selectedFile) return;

            setSending(true);
            try {
                // Handle edit mode
                if (editingReply) {
                    await onSaveEdit(content.trim());
                    setContent("");
                    setSending(false);
                    return;
                }

                const reply = await api.post("/replies", {
                    ideaId,
                    content: content.trim() || "",
                    parentId: replyingTo?.id || null,
                });

                if (selectedFile) {
                    await api.uploadFile("/attachments/upload", selectedFile, {
                        ideaId,
                        replyId: reply.id,
                    });
                }

                setContent("");
                setSelectedFile(null);
                onCancelReply?.();
                onReplySubmitted();
            } catch (error) {
                showToast("Failed to send reply", "error");
            } finally {
                setSending(false);
            }
        };

        const handlePickFile = async () => {
            if (Platform.OS === "web") {
                fileInputRef.current?.click();
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images", "videos"],
                quality: 0.8,
            });

            if (!result.canceled) {
                const asset = result.assets[0];
                setSelectedFile({
                    uri: asset.uri,
                    name: asset.fileName || "file",
                    mimeType: asset.type === "video" ? "video/mp4" : "image/jpeg",
                });
            }
        };

        const handleWebFileChange = (event) => {
            const file = event.target.files?.[0];
            if (file) {
                setSelectedFile(file);
            }
        };

        const handleKeyPress = (e) => {
            if (
                Platform.OS === "web" &&
                e.nativeEvent.key === "Enter" &&
                !e.nativeEvent.shiftKey
            ) {
                e.preventDefault();
                handleSendReply();
            }
        };

        const inputContainerContent = (
            <>
            {/* Reply context banner */}
            {replyingTo && (
                <View style={[styles.replyingToBanner, { backgroundColor: colors.surface }]}>
                    <View style={styles.replyingToContent}>
                        <Text style={[styles.replyingToLabel, { color: colors.accent }]}>
                            Replying to {replyingTo.author_name}
                        </Text>
                        <Text style={[styles.replyingToText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {replyingTo.content?.includes('/stickers/') ? '📷 Sticker' : replyingTo.content}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onCancelReply} style={styles.replyingToClose}>
                        <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            )}
            {/* Edit mode banner */}
            {editingReply && (
                <View style={[styles.replyingToBanner, { backgroundColor: colors.surface }]}>
                    <View style={styles.replyingToContent}>
                        <Text style={[styles.replyingToLabel, { color: colors.accent }]}>
                            Editing message
                        </Text>
                        <Text style={[styles.replyingToText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {editingReply.content?.includes('/stickers/') ? '📷 Sticker' : editingReply.content}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onCancelEdit} style={styles.replyingToClose}>
                        <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            )}
            <AutocompleteMenu
                query={autocompleteQuery}
                visible={showAutocomplete}
                onSelect={handleAutocompleteSelect}
                onStickerSelect={handleAutocompleteStickerSelect}
            />
            {
                Platform.OS === "web" && ( <
                    input type = "file"
                    ref = {
                        fileInputRef
                    }
                    style = {
                        {
                            display: "none",
                        }
                    }
                    accept = "image/*,video/*,.pdf,.doc,.docx,.txt"
                    onChange = {
                        handleWebFileChange
                    }
                    />
                )
            } {
                selectedFile && ( <
                    View style = {
                        [
                            styles.filePreview,
                            {
                                backgroundColor: colors.surface,
                            },
                        ]
                    } >
                    <
                    Ionicons name = "document"
                    size = {
                        16
                    }
                    color = {
                        colors.accent
                    }
                    /> <
                    Text style = {
                        [
                            styles.fileName,
                            {
                                color: colors.text,
                            },
                        ]
                    }
                    numberOfLines = {
                        1
                    } >

                    {
                        selectedFile.name
                    } <
                    /Text> <
                    TouchableOpacity onPress = {
                        () => setSelectedFile(null)
                    } >
                    <
                    Ionicons name = "close"
                    size = {
                        18
                    }
                    color = {
                        colors.textSecondary
                    }
                    /> < /
                    TouchableOpacity > <
                    /View>
                )
            } <
            View style = {
                styles.inputRow
            } >
            <
            TouchableOpacity onPress = {
                handlePickFile
            }
            style = {
                styles.attachButton
            } >
            <
            Ionicons name = "attach"
            size = {
                24
            }
            color = {
                colors.textSecondary
            }
            /> < /
            TouchableOpacity > <
            TouchableOpacity onPress = {
                onMediaPickerPress
            }
            style = {
                styles.attachButton
            } >
            <
            Ionicons name = "happy-outline"
            size = {
                24
            }
            color = {
                colors.textSecondary
            }
            /> < /
            TouchableOpacity > <
            TextInput style = {
                [
                    styles.replyInput,
                    {
                        color: colors.text,
                        backgroundColor: colors.surface,
                        minHeight: 40,
                        maxHeight: 120,
                    },
                ]
            }
            placeholder = {editingReply ? "Edit your message..." : "Add to the thread..."}
            placeholderTextColor = {
                colors.textTertiary
            }
            value = {
                content
            }
            onChangeText = {
                handleContentChange
            }
            multiline
            numberOfLines = {1}
            onKeyPress = {
                handleKeyPress
            }
            blurOnSubmit = {
                false
            }
            textAlignVertical = "center"
            /> <
            TouchableOpacity onPress = {
                handleSendReply
            }
            disabled = {
                (!content.trim() && !selectedFile) || sending
            }
            style = {
                [
                    styles.sendButton,
                    {
                        backgroundColor: colors.accent,
                    },
                    !content.trim() && !selectedFile && styles.sendButtonDisabled,
                ]
            } >
            <
            Ionicons name = {editingReply ? "checkmark" : "send"}
            size = {
                18
            }
            color = "#000" / >
            <
            /TouchableOpacity> < /
            View >
            </>
        );

        if (Platform.OS === "web") {
            return (
                <div className="backdrop-blur-xl" style={{
                    borderTop: `1px solid ${colors.glassBorder}`,
                    backgroundColor: colors.glass,
                    padding: 8,
                    paddingBottom: 8,
                }}>
                    {inputContainerContent}
                </div>
            );
        }

        return (
            <View style={[styles.inputContainer, { borderTopColor: colors.glassBorder }]}>
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[styles.inputContainerOverlay, { backgroundColor: colors.glass }]}>
                    {inputContainerContent}
                </View>
            </View>
        );
    },
);

export default function IdeaDetailScreen({
    route,
    navigation
}) {
    const {
        ideaId
    } = route.params;
    const {
        user
    } = useAuth();
    const {
        colors
    } = useTheme();
    const {
        showToast
    } = useToast();
    const [idea, setIdea] = useState(null);
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const [emojiToInsert, setEmojiToInsert] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        replyId: null,
    });
    const [readReceipts, setReadReceipts] = useState({});
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingReply, setEditingReply] = useState(null);
    const [showReactionPicker, setShowReactionPicker] = useState(null);
    const [collaborators, setCollaborators] = useState([]);
    const iconInputRef = useRef(null);
    const flatListRef = useRef(null);

    // Auto-scroll to bottom when replies change
    useEffect(() => {
        if (replies.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({
                    animated: true,
                });
            }, 100);
        }
    }, [replies]);

    const fetchData = useCallback(
        async (isPolling = false) => {
                try {
                    const [ideaData, repliesData, readsData, collabsData] = await Promise.all([
                        api.get(`/ideas/${ideaId}`),
                        api.get(`/replies/idea/${ideaId}`),
                        api.get(`/replies/reads/${ideaId}`),
                        api.get(`/collaborators/idea/${ideaId}`),
                    ]);

                    setIdea((prev) => {
                        const prevStr = JSON.stringify(prev);
                        const newStr = JSON.stringify(ideaData);
                        return prevStr === newStr ? prev : ideaData;
                    });
                    setReplies((prev) => {
                        const prevStr = JSON.stringify(prev);
                        const newStr = JSON.stringify(repliesData);
                        return prevStr === newStr ? prev : repliesData;
                    });
                    setReadReceipts(readsData || {});
                    setCollaborators(collabsData || []);
                    
                    // Mark all replies as read for current user
                    if (repliesData?.length > 0) {
                        const unreadIds = repliesData
                            .filter(r => r.user_id !== user?.id)
                            .map(r => r.id);
                        if (unreadIds.length > 0) {
                            api.post("/replies/read", { replyIds: unreadIds }).catch(() => {});
                        }
                    }
                } catch (error) {
                    console.error("Fetch error:", error);
                    if (!isPolling) {
                        showToast("Failed to load idea", "error");
                        navigation.goBack();
                    }
                } finally {
                    setLoading(false);
                }
            },
            [ideaId, user?.id],
    );

    useEffect(() => {
        fetchData();

        joinIdea(ideaId);

        const unsubCreate = onSocketEvent("reply:created", (newReply) => {
            setReplies((prev) => {
                if (prev.some((r) => r.id === newReply.id)) return prev;
                return [...prev, newReply];
            });
        });

        const unsubDelete = onSocketEvent("reply:deleted", ({
            id
        }) => {
            setReplies((prev) => prev.filter((r) => r.id !== id));
        });

        const unsubReaction = onSocketEvent("reply:reaction", ({
            replyId,
            reactions
        }) => {
            setReplies((prev) => prev.map((r) =>
                r.id === replyId ? { ...r, reactions } : r
            ));
        });

        return () => {
            leaveIdea(ideaId);
            unsubCreate();
            unsubDelete();
            unsubReaction();
        };
    }, [ideaId]);

    const handleDeleteReply = (replyId) => {
        setConfirmModal({
            visible: true,
            replyId,
        });
    };

    const confirmDeleteReply = async () => {
        const replyId = confirmModal.replyId;
        setConfirmModal({
            visible: false,
            replyId: null,
        });

        try {
            await api.delete(`/replies/${replyId}`);
            fetchData();
        } catch (error) {
            console.error("Failed to delete reply:", error);
        }
    };

    const handleReplyTo = (reply) => {
        setReplyingTo(reply);
        setShowReactionPicker(null);
    };

    const handleCancelReply = () => {
        setReplyingTo(null);
    };

    const handleEditReply = (reply) => {
        setEditingReply(reply);
        setReplyingTo(null);
        setShowReactionPicker(null);
    };

    const handleCancelEdit = () => {
        setEditingReply(null);
    };

    const handleSaveEdit = async (content) => {
        if (!editingReply) return;
        try {
            await api.put(`/replies/${editingReply.id}`, { content });
            setEditingReply(null);
            fetchData();
        } catch (error) {
            showToast("Failed to update message", "error");
        }
    };

    const handleAddReaction = async (replyId, emoji) => {
        setShowReactionPicker(null);
        try {
            await api.post(`/replies/${replyId}/reactions`, { emoji });
        } catch (error) {
            console.error("Failed to add reaction:", error);
        }
    };

    const handleRemoveReaction = async (replyId, emoji) => {
        try {
            await api.delete(`/replies/${replyId}/reactions/${encodeURIComponent(emoji)}`);
        } catch (error) {
            console.error("Failed to remove reaction:", error);
        }
    };

    const handleIconPress = () => {
        if (idea?.user_id !== user?.id) return;
        if (Platform.OS === "web") {
            iconInputRef.current?.click();
        } else {
            pickIconNative();
        }
    };

    const pickIconNative = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
        });
        if (!result.canceled) {
            uploadIcon(result.assets[0]);
        }
    };

    const handleIconWebChange = (event) => {
        const file = event.target.files?.[0];
        if (file) uploadIcon(file);
    };

    const uploadIcon = async (file) => {
        try {
            await api.uploadFile(`/ideas/${ideaId}/icon`, file);
            fetchData();
        } catch (error) {
            showToast("Failed to upload icon", "error");
        }
    };

    const handleEmojiSelect = (emoji) => {
        setShowMediaPicker(false);
        setEmojiToInsert(emoji);
    };

    const handleEmojiInserted = () => {
        setEmojiToInsert(null);
    };

    const handleStickerSelect = async (sticker) => {
        setShowMediaPicker(false);
        try {
            // Send sticker as a reply with attachment
            // First create reply
            const reply = await api.post("/replies", {
                ideaId,
                content: "", // Empty content for sticker-only reply
            });

            // Then attach sticker file
            // Since sticker is already on server, we might need a way to link it
            // But based on StickerPicker, it uploads to /stickers and returns a sticker object
            // We probably need to send the sticker URL or ID.
            // Let's assume we can send the sticker URL as an attachment or just the image URL.
            // If the API supports linking existing files, great.
            // If not, we might need to "re-upload" or just send a message with the image URL.

            // Actually, looking at the API, we usually upload a file.
            // If we have the sticker URL, we can perhaps send it as content?
            // Or maybe we need to download and re-upload?
            // Let's try sending it as an attachment if the API supports URL.
            // If not, let's just send the sticker URL as text content for now, 
            // or better, if the backend supports `file_url` in attachments.

            // Let's look at how attachments are handled. 
            // api.uploadFile('/attachments/upload', file, { ideaId, replyId })

            // If we can't easily attach an existing URL as a file, 
            // maybe we can just send the sticker URL in the content?
            // But then it won't render as an image attachment.

            // Alternative: The StickerPicker uploads to /stickers.
            // Maybe we can just use that URL.

            // Let's try to fetch the image and convert to blob/file to upload as attachment?
            // That seems heavy.

            // Let's assume for now we just send the sticker URL as content.
            // But wait, the UI renders attachments specially.
            // If I put it in content, it will show as a link preview maybe?

            // Let's try to send it as a special attachment type if possible.
            // Or maybe just send the sticker ID if the backend knows about stickers?
            // The backend seems to be generic.

            // Let's try this:
            // 1. Create reply
            // 2. Call a new endpoint or use existing one to attach sticker?

            // Let's just send the sticker URL as content for now, it's the safest bet without backend changes.
            // But the user wants "Stickers".

            // Let's look at `StickerPicker.js`. It returns `item` which has `file_url`.
            // Let's try to send the sticker as an attachment by passing the URL.
            // If `api.uploadFile` expects a File object, passing a URL won't work.

            // Let's just send the sticker URL in the content.
            // And maybe the frontend renders image URLs in content as images?
            // Line 489: checks for links and shows LinkPreview.

            // Let's check `LinkPreview`.

            // Ideally we want it to look like an image.
            // Let's try to implement `handleStickerSelect` to just send the URL for now.

            await api.post("/replies", {
                ideaId,
                content: sticker.file_url,
            });

            fetchData();
        } catch (error) {
            showToast("Failed to send sticker", "error");
        }
    };

    const renderTextWithLinks = (text, textStyle) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        
        if (parts.length === 1) {
            return <Text style={textStyle}>{text}</Text>;
        }
        
        return (
            <Text style={textStyle}>
                {parts.map((part, index) => {
                    if (part.match(urlRegex)) {
                        return (
                            <Text
                                key={index}
                                style={[textStyle, { color: colors.accent, textDecorationLine: 'underline' }]}
                                onPress={() => {
                                    if (Platform.OS === 'web') {
                                        window.open(part, '_blank');
                                    } else {
                                        Linking.openURL(part);
                                    }
                                }}
                            >
                                {part}
                            </Text>
                        );
                    }
                    return part;
                })}
            </Text>
        );
    };

    const renderReply = ({
        item,
        index
    }) => {
        const isOwn = item.user_id === user?.id;

        return ( <
                Animated.View entering = {
                    FadeInUp.delay(index * 50).duration(300)
                }
                style = {
                    [styles.replyContainer, isOwn && styles.ownReply]
                } >
                <
                GlassCard style = {
                    [styles.replyCard, isOwn && styles.ownReplyCard]
                } >
                {/* Reply context if this is a reply to another message */}
                {item.parent_id && item.parent_content && (
                    <View style={[styles.replyContext, { borderLeftColor: colors.accent }]}>
                        <Text style={[styles.replyContextAuthor, { color: colors.accent }]}>
                            ↩ {item.parent_author_name}
                        </Text>
                        <Text style={[styles.replyContextContent, { color: colors.textTertiary }]} numberOfLines={1}>
                            {item.parent_content.includes('/stickers/') ? '📷 Sticker' : item.parent_content}
                        </Text>
                    </View>
                )}
                <
                View style = {
                    styles.replyHeader
                } >

                {
                    item.author_avatar ? ( <
                        Image source = {
                            {
                                uri: item.author_avatar,
                            }
                        }
                        style = {
                            styles.avatar
                        }
                        />
                    ) : ( <
                        View style = {
                            [
                                styles.avatar,
                                {
                                    backgroundColor: colors.accent,
                                },
                            ]
                        } >
                        <
                        Text style = {
                            styles.avatarText
                        } >

                        {
                            item.author_name?.charAt(0)?.toUpperCase()
                        } <
                        /Text> < /
                        View >
                    )
                } <
                View style = {
                    styles.replyMeta
                } >
                <
                Text style = {
                    [
                        styles.authorName,
                        {
                            color: colors.text,
                        },
                    ]
                } >

                {
                    item.author_name
                } <
                /Text> <
                Text style = {
                    [
                        styles.replyTime,
                        {
                            color: colors.textTertiary,
                        },
                    ]
                } >

                {
                    new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })
                }{item.updated_at && new Date(item.updated_at).getTime() > new Date(item.created_at).getTime() + 1000 ? ' (edited)' : ''} <
                /Text> < /
                View > {
                    isOwn && !item.content?.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i) && !item.content?.includes('/stickers/') && ( <
                        TouchableOpacity onPress = {
                            () => handleEditReply(item)
                        }
                        style = {
                            styles.deleteButton
                        } >
                        <
                        Ionicons name = "pencil-outline"
                        size = {
                            16
                        }
                        color = {
                            colors.textTertiary
                        }
                        /> < /
                        TouchableOpacity >
                    )
                } {
                    isOwn && ( <
                        TouchableOpacity onPress = {
                            () => handleDeleteReply(item.id)
                        }
                        style = {
                            styles.deleteButton
                        } >
                        <
                        Ionicons name = "trash-outline"
                        size = {
                            16
                        }
                        color = {
                            colors.textTertiary
                        }
                        /> < /
                        TouchableOpacity >
                    )
                } <
                /View> {
                item.content ? (
                    // Check if content is a sticker/image URL
                    item.content.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i) ||
                    item.content.includes('/stickers/') ? (
                        <TouchableOpacity 
                            onPress={() => setSelectedImage(item.content)}
                            style={styles.stickerReply}
                        >
                            {Platform.OS === "web" ? (
                                <img 
                                    src={item.content} 
                                    alt="sticker"
                                    style={{
                                        maxWidth: 150,
                                        maxHeight: 150,
                                        borderRadius: 8,
                                        objectFit: 'contain'
                                    }}
                                />
                            ) : (
                                <Image 
                                    source={{ uri: item.content }}
                                    style={styles.stickerImage}
                                    resizeMode="contain"
                                />
                            )}
                        </TouchableOpacity>
                    ) : (
                        renderTextWithLinks(item.content, [
                            styles.replyContent,
                            { color: colors.text },
                        ])
                    )
                ) : null
            } {
                item.content &&
                    !item.content.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i) &&
                    !item.content.includes('/stickers/') &&
                    (item.content.match(/(https?:\/\/[^\s]+)/g) || [])[0] && ( <
                        LinkPreview url = {
                            (item.content.match(/(https?:\/\/[^\s]+)/g) || [])[0]
                        }
                        />
                    )
            } {
                item.attachments?.filter(Boolean).length > 0 && ( <
                    View style = {
                        styles.attachments
                    } >

                    {
                        item.attachments.filter(Boolean).map((att) => {
                            const isImage = att.file_type?.startsWith("image/");
                            const isVideo = att.file_type?.startsWith("video/");

                            if (isImage) {
                                return ( <
                                    TouchableOpacity key = {
                                        att.id
                                    }
                                    onPress = {
                                        () => setSelectedImage(att.file_url)
                                    }
                                    style = {
                                        styles.imageAttachment
                                    } >

                                    {
                                        Platform.OS === "web" ? ( <
                                            img src = {
                                                att.file_url
                                            }
                                            alt = {
                                                att.file_name
                                            }
                                            style = {
                                                {
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "cover",
                                                    borderRadius: 8,
                                                }
                                            }
                                            />
                                        ) : ( <
                                            Image source = {
                                                {
                                                    uri: att.file_url,
                                                }
                                            }
                                            style = {
                                                styles.attachmentImage
                                            }
                                            />
                                        )
                                    } <
                                    /TouchableOpacity>
                                );
                            }

                            if (isVideo) {
                                return ( <
                                    View key = {
                                        att.id
                                    }
                                    style = {
                                        styles.videoAttachment
                                    } >

                                    {
                                        Platform.OS === "web" ? ( <
                                            video src = {
                                                att.file_url
                                            }
                                            controls style = {
                                                {
                                                    width: "100%",
                                                    maxHeight: 200,
                                                    borderRadius: 8,
                                                }
                                            }
                                            />
                                        ) : ( <
                                            View style = {
                                                [
                                                    styles.attachment,
                                                    {
                                                        borderColor: colors.glassBorder,
                                                    },
                                                ]
                                            } >
                                            <
                                            Ionicons name = "videocam"
                                            size = {
                                                14
                                            }
                                            color = {
                                                colors.textSecondary
                                            }
                                            /> <
                                            Text style = {
                                                [
                                                    styles.attachmentName,
                                                    {
                                                        color: colors.textSecondary,
                                                    },
                                                ]
                                            }
                                            numberOfLines = {
                                                1
                                            } >

                                            {
                                                att.file_name
                                            } <
                                            /Text> < /
                                            View >
                                        )
                                    } <
                                    /View>
                                );
                            }

                            return ( <
                                TouchableOpacity key = {
                                    att.id
                                }
                                style = {
                                    [
                                        styles.attachment,
                                        {
                                            borderColor: colors.glassBorder,
                                        },
                                    ]
                                }
                                onPress = {
                                    () =>
                                    Platform.OS === "web" &&
                                    window.open(att.file_url, "_blank")
                                } >
                                <
                                Ionicons name = "document"
                                size = {
                                    14
                                }
                                color = {
                                    colors.textSecondary
                                }
                                /> <
                                Text style = {
                                    [
                                        styles.attachmentName,
                                        {
                                            color: colors.textSecondary,
                                        },
                                    ]
                                }
                                numberOfLines = {
                                    1
                                } >

                                {
                                    att.file_name
                                } <
                                /Text> < /
                                TouchableOpacity >
                            );
                        })
                    } <
                    /View>
                )
            }
            {/* Reactions display */}
            {item.reactions?.length > 0 && (
                <View style={styles.reactionsContainer}>
                    {Object.entries(
                        item.reactions.reduce((acc, r) => {
                            acc[r.emoji] = acc[r.emoji] || { count: 0, users: [], hasOwn: false };
                            acc[r.emoji].count++;
                            acc[r.emoji].users.push(r.user_name);
                            if (r.user_id === user?.id) acc[r.emoji].hasOwn = true;
                            return acc;
                        }, {})
                    ).map(([emoji, data]) => (
                        <TouchableOpacity 
                            key={emoji}
                            style={[
                                styles.reactionBadge, 
                                { backgroundColor: data.hasOwn ? `${colors.accent}30` : colors.surface }
                            ]}
                            onPress={() => data.hasOwn ? handleRemoveReaction(item.id, emoji) : handleAddReaction(item.id, emoji)}
                        >
                            <Text style={styles.reactionEmoji}>{emoji}</Text>
                            <Text style={[styles.reactionCount, { color: colors.text }]}>{data.count}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
            {/* Action buttons */}
            <View style={styles.replyActions}>
                <TouchableOpacity 
                    style={styles.replyActionBtn}
                    onPress={() => handleReplyTo(item)}
                >
                    <Ionicons name="arrow-undo-outline" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.replyActionBtn}
                    onPress={() => setShowReactionPicker(showReactionPicker === item.id ? null : item.id)}
                >
                    <Ionicons name="happy-outline" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
            </View>
            {/* Quick reaction picker */}
            {showReactionPicker === item.id && (
                <View style={[styles.quickReactions, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                    {['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'].map(emoji => (
                        <TouchableOpacity 
                            key={emoji} 
                            style={styles.quickReactionBtn}
                            onPress={() => handleAddReaction(item.id, emoji)}
                        >
                            <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )} <
            /GlassCard>
            {/* Read receipts indicator */}
            {isOwn && (() => {
                const reads = readReceipts[item.id] || [];
                const otherReads = reads.filter(r => r.user_id !== user?.id);
                if (otherReads.length === 0) {
                    return (
                        <Text style={[styles.readReceipt, { color: colors.textTertiary }]}>
                            Unseen
                        </Text>
                    );
                }
                const names = otherReads.map(r => r.name?.split(' ')[0]).join(', ');
                return (
                    <Text style={[styles.readReceipt, { color: colors.textTertiary }]}>
                        Seen by {names}
                    </Text>
                );
            })()} < /
        Animated.View >
    );
};

const renderHeader = () => ( <
        View style = {
            styles.header
        } >

        {
            Platform.OS === "web" && ( <
                input type = "file"
                ref = {
                    iconInputRef
                }
                style = {
                    {
                        display: "none",
                    }
                }
                accept = "image/*"
                onChange = {
                    handleIconWebChange
                }
                />
            )
        } <
        Animated.View entering = {
            FadeIn.duration(400)
        } >
        <
        GlassCard intensity = {
            40
        } >
        <
        View style = {
            styles.ideaHeader
        } >
        <
        TouchableOpacity onPress = {
            handleIconPress
        }
        disabled = {
            idea?.user_id !== user?.id
        }
        style = {
            [
                styles.iconContainer,
                {
                    backgroundColor: `${colors.accent}20`,
                },
            ]
        } >

        {
            idea?.icon_url ? ( <
                Image source = {
                    {
                        uri: idea.icon_url,
                    }
                }
                style = {
                    styles.ideaIcon
                }
                />
            ) : ( <
                Ionicons name = "bulb"
                size = {
                    28
                }
                color = {
                    colors.accent
                }
                />
            )
        } <
        /TouchableOpacity> <
        View style = {
            {
                flex: 1,
            }
        } >

        {
            idea?.user_id === user?.id && ( <
                Text style = {
                    [
                        styles.tapHint,
                        {
                            color: colors.textTertiary,
                        },
                    ]
                } >
                Tap icon to customize <
                /Text>
            )
        } <
        Text style = {
            [
                styles.ideaTitle,
                {
                    color: colors.text,
                },
            ]
        } >

        {
            idea?.title
        } <
        /Text> < /
        View > <
        /View> {
        idea?.content && ( <
            Text style = {
                [
                    styles.ideaContent,
                    {
                        color: colors.textSecondary,
                    },
                ]
            } >

            {
                idea.content
            } <
            /Text>
        )
    } <
    View style = {
        styles.ideaMeta
    } >
    <
    Text style = {
        [
            styles.metaText,
            {
                color: colors.textTertiary,
            },
        ]
    } >
    by {
        idea?.owner_name
    }• {
        new Date(idea?.created_at).toLocaleDateString()
    } <
    /Text>
    {/* Participant avatars */}
    <View style={styles.participantsRow}>
        {/* Owner avatar */}
        {idea?.owner_avatar ? (
            <Image source={{ uri: idea.owner_avatar }} style={styles.participantAvatar} />
        ) : (
            <View style={[styles.participantAvatar, { backgroundColor: colors.accent }]}>
                <Text style={styles.participantAvatarText}>{idea?.owner_name?.charAt(0)?.toUpperCase()}</Text>
            </View>
        )}
        {/* Collaborator avatars */}
        {collaborators.filter(c => c.status === 'accepted' && c.user_id !== idea?.user_id).slice(0, 5).map((collab, idx) => (
            collab.avatar_url ? (
                <Image key={collab.id} source={{ uri: collab.avatar_url }} style={[styles.participantAvatar, { marginLeft: -8 }]} />
            ) : (
                <View key={collab.id} style={[styles.participantAvatar, { backgroundColor: colors.accent, marginLeft: -8 }]}>
                    <Text style={styles.participantAvatarText}>{collab.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                </View>
            )
        ))}
        {collaborators.filter(c => c.status === 'accepted' && c.user_id !== idea?.user_id).length > 5 && (
            <View style={[styles.participantAvatar, { backgroundColor: colors.surface, marginLeft: -8 }]}>
                <Text style={[styles.participantAvatarText, { color: colors.text }]}>+{collaborators.filter(c => c.status === 'accepted').length - 5}</Text>
            </View>
        )}
        {idea?.user_id === user?.id && ( 
            <TouchableOpacity style={[styles.participantAvatar, styles.inviteAvatarBtn, { marginLeft: -8, borderColor: colors.accent }]} onPress={() => setShowInvite(!showInvite)}>
                <Ionicons name="person-add-outline" size={14} color={colors.accent} />
            </TouchableOpacity>
        )}
    </View>
 <
/View> < /
GlassCard > <
    /Animated.View> {
showInvite && ( <
    InviteForm ideaId = {
        ideaId
    }
    colors = {
        colors
    }
    onClose = {
        () => setShowInvite(false)
    }
    showToast = {
        showToast
    }
    />
)
} <
Text style = {
        [
            styles.repliesTitle,
            {
                color: colors.textSecondary,
            },
        ]
    } >
    Thread({
        replies.length
    }) <
    /Text> < /
View >
);

if (loading) {
    return ( <
        BackgroundWrapper
        overrideBackgroundUrl = {idea?.background_url}
        overrideBackgroundType = {idea?.background_type}
        >
        <
        SafeAreaView style = {
            styles.container
        } >
        <
        View style = {
            styles.loadingContainer
        } >
        <
        Ionicons name = "bulb"
        size = {
            48
        }
        color = {
            colors.accent
        }
        /> < /
        View > <
        /SafeAreaView> < /
        BackgroundWrapper >
    );
}

return ( <
    BackgroundWrapper
    overrideBackgroundUrl = {idea?.background_url}
    overrideBackgroundType = {idea?.background_type}
    >
    <
    SafeAreaView style = {
        styles.container
    }
    edges = {
        ["top"]
    } >
    <
    View style = {
        styles.navBar
    } >
    <
    TouchableOpacity onPress = {
        () => navigation.goBack()
    }
    style = {
        styles.backButton
    } >
    <
    Ionicons name = "arrow-back"
    size = {
        24
    }
    color = {
        colors.text
    }
    /> < /
    TouchableOpacity > <
    Text style = {
        [
            styles.navTitle,
            {
                color: colors.text,
            },
        ]
    }
    numberOfLines = {
        1
    } >

    {
        idea?.title
    } <
    /Text> <
    View style = {
        styles.navActions
    } >
    <
    TouchableOpacity onPress = {
        () => navigation.navigate("Friends")
    }
    style = {
        styles.navButton
    } >
    <
    Ionicons name = "notifications-outline"
    size = {
        22
    }
    color = {
        colors.text
    }
    /> < /
    TouchableOpacity > <
    TouchableOpacity onPress = {
        () =>
        navigation.navigate("ThreadSettings", {
            ideaId,
        })
    }
    style = {
        styles.navButton
    } >
    <
    Ionicons name = "settings-outline"
    size = {
        22
    }
    color = {
        colors.text
    }
    /> < /
    TouchableOpacity > <
    TouchableOpacity onPress = {
        () => navigation.navigate("Settings")
    }
    style = {
        styles.navButton
    } >
    {
        user?.avatar_url ? ( <
            Image source = {
                {
                    uri: user.avatar_url,
                }
            }
            style = {
                styles.navAvatar
            }
            />
        ) : ( <
            View style = {
                [
                    styles.navAvatar,
                    {
                        backgroundColor: colors.accent,
                    },
                ]
            } >
            <
            Text style = {
                styles.navAvatarText
            } >
            {
                user?.name?.charAt(0)?.toUpperCase()
            } <
            /Text> < /
            View >
        )
    } <
    /TouchableOpacity> < /
    View > <
    /View> <
    KeyboardAvoidingView style = {
        styles.flex
    }
    behavior = {
        Platform.OS === "ios" ? "padding" : undefined
    } >
    <
    FlatList ref = {
        flatListRef
    }
    data = {
        replies
    }
    keyExtractor = {
        (item) => item.id
    }
    renderItem = {
        renderReply
    }
    ListHeaderComponent = {
        renderHeader
    }
    contentContainerStyle = {
        styles.list
    }
    /> <
    KeyboardAvoidingView behavior = {
        Platform.OS === "ios" ? "padding" : "height"
    }
    keyboardVerticalOffset = {
        Platform.OS === "ios" ? 88 : 0
    } >
    <
    MediaPicker visible = {
        showMediaPicker
    }
    onClose = {
        () => setShowMediaPicker(false)
    }
    onSelectSticker = {
        handleStickerSelect
    }
    onSelectEmoji = {
        handleEmojiSelect
    }
    /> <
    ReplyComposer ideaId = {
        ideaId
    }
    colors = {
        colors
    }
    onReplySubmitted = {
        () => fetchData(true)
    }
    showToast = {
        showToast
    }
    onMediaPickerPress = {
        () => setShowMediaPicker(true)
    }
    emojiToInsert = {
        emojiToInsert
    }
    onEmojiInserted = {
        handleEmojiInserted
    }
    replyingTo = {
        replyingTo
    }
    onCancelReply = {
        handleCancelReply
    }
    editingReply = {
        editingReply
    }
    onCancelEdit = {
        handleCancelEdit
    }
    onSaveEdit = {
        handleSaveEdit
    }
    /> < /
    KeyboardAvoidingView > {
        /* Image Modal */
    } {
        selectedImage &&
            (Platform.OS === "web" ? ( <
                div style = {
                    {
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }
                }
                onClick = {
                    () => setSelectedImage(null)
                } >
                <
                img src = {
                    selectedImage
                }
                alt = "Full size"
                style = {
                    {
                        maxWidth: "90%",
                        maxHeight: "90%",
                        objectFit: "contain",
                    }
                }
                /> <
                TouchableOpacity style = {
                    styles.closeImageButton
                }
                onPress = {
                    () => setSelectedImage(null)
                } >
                <
                Ionicons name = "close"
                size = {
                    28
                }
                color = "#fff" / >
                <
                /TouchableOpacity> < /
                div >
            ) : ( <
                Modal visible = {
                    !!selectedImage
                }
                transparent animationType = "fade" >
                <
                Pressable style = {
                    styles.imageModal
                }
                onPress = {
                    () => setSelectedImage(null)
                } >
                <
                Image source = {
                    {
                        uri: selectedImage,
                    }
                }
                style = {
                    styles.fullImage
                }
                resizeMode = "contain" /
                >
                <
                TouchableOpacity style = {
                    styles.closeImageButton
                }
                onPress = {
                    () => setSelectedImage(null)
                } >
                <
                Ionicons name = "close"
                size = {
                    28
                }
                color = "#fff" / >
                <
                /TouchableOpacity> < /
                Pressable > <
                /Modal>
            ))
    } {
        /* Delete Confirmation Modal */
    } {
        confirmModal.visible &&
            (Platform.OS === "web" ? ( <
                div style = {
                    {
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }
                }
                onClick = {
                    () =>
                    setConfirmModal({
                        visible: false,
                        replyId: null,
                    })
                } >
                <
                div onClick = {
                    (e) => e.stopPropagation()
                }
                style = {
                    {
                        backgroundColor: colors.glass,
                        borderRadius: 16,
                        padding: 24,
                        maxWidth: 320,
                        width: "90%",
                        border: `1px solid ${colors.glassBorder}`,
                    }
                } >
                <
                Text style = {
                    [
                        styles.confirmTitle,
                        {
                            color: colors.text,
                        },
                    ]
                } >
                Delete Reply ?
                <
                /Text> <
                Text style = {
                    [
                        styles.confirmMessage,
                        {
                            color: colors.textSecondary,
                        },
                    ]
                } >
                This action cannot be undone. <
                /Text> <
                View style = {
                    styles.confirmButtons
                } >
                <
                TouchableOpacity style = {
                    [
                        styles.confirmButton,
                        styles.cancelButton,
                        {
                            borderColor: colors.glassBorder,
                        },
                    ]
                }
                onPress = {
                    () =>
                    setConfirmModal({
                        visible: false,
                        replyId: null,
                    })
                } >
                <
                Text style = {
                    [
                        styles.confirmButtonText,
                        {
                            color: colors.text,
                        },
                    ]
                } >

                Cancel <
                /Text> < /
                TouchableOpacity > <
                TouchableOpacity style = {
                    [styles.confirmButton, styles.deleteConfirmButton]
                }
                onPress = {
                    confirmDeleteReply
                } >
                <
                Text style = {
                    [
                        styles.confirmButtonText,
                        {
                            color: "#fff",
                        },
                    ]
                } >

                Delete <
                /Text> < /
                TouchableOpacity > <
                /View> < /
                div > <
                /div>
            ) : ( <
                Modal visible = {
                    confirmModal.visible
                }
                transparent animationType = "fade" >
                <
                View style = {
                    styles.modalOverlay
                } >
                <
                View style = {
                    [
                        styles.confirmModalContent,
                        {
                            backgroundColor: colors.glass,
                            borderColor: colors.glassBorder,
                        },
                    ]
                } >
                <
                Text style = {
                    [
                        styles.confirmTitle,
                        {
                            color: colors.text,
                        },
                    ]
                } >
                Delete Reply ?
                <
                /Text> <
                Text style = {
                    [
                        styles.confirmMessage,
                        {
                            color: colors.textSecondary,
                        },
                    ]
                } >
                This action cannot be undone. <
                /Text> <
                View style = {
                    styles.confirmButtons
                } >
                <
                TouchableOpacity style = {
                    [
                        styles.confirmButton,
                        styles.cancelButton,
                        {
                            borderColor: colors.glassBorder,
                        },
                    ]
                }
                onPress = {
                    () =>
                    setConfirmModal({
                        visible: false,
                        replyId: null,
                    })
                } >
                <
                Text style = {
                    [
                        styles.confirmButtonText,
                        {
                            color: colors.text,
                        },
                    ]
                } >

                Cancel <
                /Text> < /
                TouchableOpacity > <
                TouchableOpacity style = {
                    [styles.confirmButton, styles.deleteConfirmButton]
                }
                onPress = {
                    confirmDeleteReply
                } >
                <
                Text style = {
                    [
                        styles.confirmButtonText,
                        {
                            color: "#fff",
                        },
                    ]
                } >

                Delete <
                /Text> < /
                TouchableOpacity > <
                /View> < /
                View > <
                /View> < /
                Modal >
            ))
    } </KeyboardAvoidingView><
    /SafeAreaView> < /
    BackgroundWrapper >
);
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    navBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
    },
    navTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
        marginHorizontal: 8,
    },
    navActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    navButton: {
        padding: 8,
    },
    navAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    navAvatarText: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#000",
    },
    stickerReply: {
        marginTop: 4,
    },
    stickerImage: {
        width: 150,
        height: 150,
        borderRadius: 8,
    },
    list: {
        padding: 16,
        paddingBottom: 20,
    },
    header: {
        marginBottom: 16,
    },
    ideaHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        overflow: "hidden",
    },
    ideaIcon: {
        width: 52,
        height: 52,
        borderRadius: 14,
    },
    tapHint: {
        fontSize: 10,
        marginBottom: 2,
    },
    ideaTitle: {
        fontSize: 20,
        fontWeight: "700",
    },
    ideaContent: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 12,
    },
    ideaMeta: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    metaText: {
        fontSize: 12,
    },
    participantsRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
    },
    participantAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(0,0,0,0.2)",
    },
    participantAvatarText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#000",
    },
    inviteAvatarBtn: {
        backgroundColor: "transparent",
        borderStyle: "dashed",
    },
    inviteButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    inviteText: {
        fontSize: 14,
        fontWeight: "600",
    },
    inviteSection: {
        marginTop: 12,
    },
    inviteTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
    },
    inviteInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        fontSize: 14,
    },
    repliesTitle: {
        fontSize: 14,
        fontWeight: "600",
        marginTop: 20,
        marginBottom: 8,
    },
    replyContainer: {
        marginBottom: 12,
        maxWidth: "85%",
        alignSelf: "flex-start",
    },
    ownReply: {
        alignSelf: "flex-end",
    },
    replyCard: {},
    ownReplyCard: {},
    replyHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: "#000",
        fontSize: 12,
        fontWeight: "600",
    },
    replyMeta: {
        marginLeft: 8,
        flex: 1,
    },
    authorName: {
        fontSize: 13,
        fontWeight: "600",
    },
    replyTime: {
        fontSize: 11,
    },
    deleteButton: {
        padding: 4,
    },
    replyContent: {
        fontSize: 14,
        lineHeight: 20,
    },
    attachments: {
        marginTop: 8,
        gap: 8,
    },
    attachment: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    attachmentName: {
        fontSize: 12,
        flex: 1,
    },
    imageAttachment: {
        width: 200,
        height: 150,
        borderRadius: 8,
        overflow: "hidden",
    },
    attachmentImage: {
        width: "100%",
        height: "100%",
        borderRadius: 8,
    },
    videoAttachment: {
        maxWidth: 280,
    },
    inputContainer: {
        position: "relative",
        borderTopWidth: 1,
        overflow: "hidden",
    },
    inputContainerOverlay: {
        padding: 8,
        paddingBottom: Platform.OS === "ios" ? 8 : 8,
    },
    filePreview: {
        flexDirection: "row",
        alignItems: "center",
        padding: 8,
        borderRadius: 8,
        marginBottom: 8,
        gap: 8,
    },
    fileName: {
        flex: 1,
        fontSize: 13,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
    },
    attachButton: {
        padding: 8,
    },
    replyInput: {
        flex: 1,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 14,
        maxHeight: 100,
        minHeight: 40,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    imageModal: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
        justifyContent: "center",
        alignItems: "center",
    },
    fullImage: {
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height * 0.8,
    },
    closeImageButton: {
        position: "absolute",
        top: 50,
        right: 20,
        padding: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
    },
    confirmModalContent: {
        borderRadius: 16,
        padding: 24,
        maxWidth: 320,
        width: "90%",
        borderWidth: 1,
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 8,
    },
    confirmMessage: {
        fontSize: 14,
        marginBottom: 24,
    },
    confirmButtons: {
        flexDirection: "row",
        gap: 12,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
    },
    cancelButton: {
        borderWidth: 1,
        backgroundColor: "transparent",
    },
    deleteConfirmButton: {
        backgroundColor: "#ef4444",
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: "600",
    },
    readReceipt: {
        fontSize: 11,
        marginTop: 4,
        textAlign: "right",
        paddingRight: 4,
    },
    replyContext: {
        borderLeftWidth: 3,
        paddingLeft: 8,
        marginBottom: 8,
    },
    replyContextAuthor: {
        fontSize: 11,
        fontWeight: "600",
    },
    replyContextContent: {
        fontSize: 12,
    },
    reactionsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 8,
    },
    reactionBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    reactionEmoji: {
        fontSize: 14,
    },
    reactionCount: {
        fontSize: 12,
        fontWeight: "500",
    },
    replyActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.1)",
    },
    replyActionBtn: {
        padding: 4,
    },
    quickReactions: {
        flexDirection: "row",
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 8,
        gap: 4,
    },
    quickReactionBtn: {
        padding: 4,
    },
    quickReactionEmoji: {
        fontSize: 18,
    },
    replyingToBanner: {
        flexDirection: "row",
        alignItems: "center",
        padding: 8,
        marginBottom: 8,
        borderRadius: 8,
    },
    replyingToContent: {
        flex: 1,
    },
    replyingToLabel: {
        fontSize: 12,
        fontWeight: "600",
    },
    replyingToText: {
        fontSize: 12,
    },
    replyingToClose: {
        padding: 4,
    },
});
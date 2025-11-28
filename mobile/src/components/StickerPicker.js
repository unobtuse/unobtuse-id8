import React, {
    useState,
    useEffect,
    useRef
} from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Image,
    ActivityIndicator,
    Platform,
    Dimensions
} from 'react-native';
import {
    Ionicons
} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
    useTheme
} from '../context/ThemeContext';
import {
    useToast
} from '../context/ToastContext';
import {
    api
} from '../services/api';
import Button from './Button';

const BlurView = Platform.OS !== 'web' ? require('expo-blur').BlurView : View;

export default function StickerPicker({
    visible,
    onSelect,
    onClose
}) {
    const {
        colors
    } = useTheme();
    const {
        showToast
    } = useToast();
    const [stickers, setStickers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const stickerInputRef = useRef(null);

    useEffect(() => {
        if (visible) {
            fetchStickers();
        }
    }, [visible]);

    const fetchStickers = async () => {
        try {
            const data = await api.get('/stickers');
            setStickers(data);
        } catch (error) {
            console.error('Failed to fetch stickers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSticker = () => {
        if (Platform.OS === 'web') {
            stickerInputRef.current ? .click();
        } else {
            pickStickerNative();
        }
    };

    const pickStickerNative = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.8,
        });
        if (!result.canceled) {
            await uploadSticker(result.assets[0]);
        }
    };

    const handleWebChange = async (event) => {
        const file = event.target.files ? . [0];
        if (file) {
            await uploadSticker(file);
            if (stickerInputRef.current) stickerInputRef.current.value = '';
        }
    };

    const uploadSticker = async (file) => {
        setUploading(true);
        try {
            const result = await api.uploadFile('/stickers', file);
            setStickers(prev => [result, ...prev]);
            showToast('Sticker added!', 'success');
        } catch (error) {
            showToast(error.message || 'Failed to upload sticker', 'error');
        } finally {
            setUploading(false);
        }
    };

    if (!visible) return null;

    const isVideo = (type) => type ? .startsWith('video/');

    const renderSticker = ({
        item
    }) => ( <
        TouchableOpacity onPress = {
            () => onSelect(item)
        }
        style = {
            styles.stickerItem
        } > {
            isVideo(item.file_type) ? ( <
                View style = {
                    [styles.stickerMedia, styles.videoPlaceholder]
                } >
                <
                Ionicons name = "videocam"
                size = {
                    24
                }
                color = "#fff" / >
                <
                /View>
            ) : ( <
                Image source = {
                    {
                        uri: item.file_url
                    }
                }
                style = {
                    styles.stickerMedia
                }
                />
            )
        } <
        /TouchableOpacity>
    );

    const Wrapper = Platform.OS === 'web' ? View : Modal;
    const wrapperProps = Platform.OS === 'web' ? {
        style: styles.container
    } : {
        transparent: true,
        animationType: 'slide',
        visible: visible,
        onRequestClose: onClose
    };

    return ( <
        Wrapper {
            ...wrapperProps
        } >
        <
        BlurView intensity = {
            Platform.OS === 'web' ? 0 : 80
        }
        tint = {
            colors.theme === 'dark' ? 'dark' : 'light'
        }
        style = {
            [
                styles.picker,
                {
                    borderColor: colors.glassBorder,
                    backgroundColor: Platform.OS === 'web' ? colors.glass : 'transparent'
                }
            ]
        } >
        <
        View style = {
            styles.header
        } >
        <
        Text style = {
            [styles.title, {
                color: colors.text
            }]
        } > Stickers < /Text> <
        TouchableOpacity onPress = {
            onClose
        }
        style = {
            styles.closeBtn
        } >
        <
        Ionicons name = "close"
        size = {
            20
        }
        color = {
            colors.textSecondary
        }
        /> <
        /TouchableOpacity> <
        /View>

        {
            loading ? ( <
                View style = {
                    styles.loadingContainer
                } >
                <
                ActivityIndicator color = {
                    colors.accent
                }
                /> <
                /View>
            ) : stickers.length === 0 ? ( <
                View style = {
                    styles.emptyContainer
                } >
                <
                Ionicons name = "happy-outline"
                size = {
                    40
                }
                color = {
                    colors.textTertiary
                }
                /> <
                Text style = {
                    [styles.emptyText, {
                        color: colors.textSecondary
                    }]
                } >
                No stickers yet <
                /Text> <
                Button title = {
                    uploading ? "Uploading..." : "Add Sticker"
                }
                onPress = {
                    handleAddSticker
                }
                loading = {
                    uploading
                }
                style = {
                    {
                        marginTop: 12
                    }
                }
                icon = {
                    < Ionicons name = "add"
                    size = {
                        20
                    }
                    color = "#000" / >
                }
                /> <
                /View>
            ) : ( <
                FlatList data = {
                    stickers
                }
                renderItem = {
                    renderSticker
                }
                keyExtractor = {
                    (item) => item.id.toString()
                }
                numColumns = {
                    4
                }
                contentContainerStyle = {
                    styles.grid
                }
                showsVerticalScrollIndicator = {
                    false
                }
                />
            )
        } {
            Platform.OS === 'web' && ( <
                input type = "file"
                ref = {
                    stickerInputRef
                }
                style = {
                    {
                        display: 'none'
                    }
                }
                accept = "image/*,video/*,.gif"
                onChange = {
                    handleWebChange
                }
                />
            )
        } <
        /BlurView> <
        /Wrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    picker: {
        marginHorizontal: 8,
        borderRadius: 16,
        borderWidth: 1,
        maxHeight: 280,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
    },
    closeBtn: {
        padding: 4,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 15,
        marginTop: 12,
    },
    grid: {
        padding: 8,
    },
    stickerItem: {
        flex: 1,
        aspectRatio: 1,
        margin: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    stickerMedia: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    videoPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
});
export default {
    async fetch(request, env) {
        return handleRequest(env, request);
    }
};

// Pass 'request' to sub-functions
async function handleRequest(env, request) {
    const images = await fetchFlickrImages(env, request);  // Fixed parameter order
    const randomImage = images[Math.floor(Math.random() * images.length)];

    return new Response(JSON.stringify({ image: randomImage }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'max-age=3600'
        }
    });
}

// Cache parameters
const MAX_IMAGES = 10;
const SAFETY_LIMIT = 20;
const cacheTTL = 86400;  // 1 day

async function fetchFlickrImages(env, request) {
    const cache = caches.default;
    let cacheKey;

    // Ensure a valid URL for caching
    try {
        cacheKey = new URL(request.url, request.url);
    } catch (error) {
        console.error("Invalid URL encountered:", error);
        return [env.FALLBACK_IMAGE];
    }

    let response = await cache.match(cacheKey);
    if (response) {
        return await response.json();
    }

    const url = `https://www.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${env.FLICKR_API_KEY}&photoset_id=${env.FLICKR_ALBUM_ID}&user_id=${env.FLICKR_USER_ID}&format=json&nojsoncallback=1`;

    try {
        response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch Flickr album.');

        const data = await response.json();
        const imageUrls = data.photoset.photo.map(photo =>
            `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`
        );

        response = new Response(JSON.stringify(imageUrls), {
            headers: { 'Content-Type': 'application/json' }
        });
        response.headers.append('Cache-Control', `max-age=${cacheTTL}`);
        cache.put(cacheKey, response.clone());

        return imageUrls.length > 0 ? imageUrls : [env.FALLBACK_IMAGE];
    } catch (error) {
        console.error('Error fetching Flickr images:', error);
        return [env.FALLBACK_IMAGE];
    }
}




export default {
    async fetch(request, env) {
        return handleRequest(env, request);
    }
};

async function handleRequest(env, request) {
    const images = await fetchFlickrImages(env, request);
    const randomImage = images[Math.floor(Math.random() * images.length)];

    return new Response(JSON.stringify(randomImage), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'max-age=3600'
        }
    });
}

// Fetch Flickr album and return full image metadata
async function fetchFlickrImages(env, request) {
    const cache = caches.default;
    let cacheKey;

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
        const text = await response.text();
        const data = JSON.parse(text);

        if (data.stat !== 'ok' || !data.photoset || !data.photoset.photo) {
            throw new Error('Failed to retrieve photoset.');
        }

        // Cache the full response
        response = new Response(JSON.stringify(data.photoset.photo), {
            headers: { 'Content-Type': 'application/json' }
        });
        response.headers.append('Cache-Control', `max-age=86400`);  // Cache for 1 day
        cache.put(cacheKey, response.clone());

        return data.photoset.photo.length > 0 ? data.photoset.photo : [{ id: env.FALLBACK_IMAGE }];
    } catch (error) {
        console.error('Error fetching Flickr images:', error.message);
        return [{ id: env.FALLBACK_IMAGE }];
    }
}

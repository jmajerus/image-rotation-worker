let currentIndex = 0;  // Track index in worker memory (resets when worker restarts)

export default {
    async fetch(request, env) {
        return handleRequest(env, request);
    }
};

async function handleRequest(env, request) {
    const images = await fetchFlickrImages(env);

    if (images.length === 0) {
        return new Response(JSON.stringify({ image: env.FALLBACK_IMAGE }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Serve the current image and update index
    const imageUrl = images[currentIndex];
    currentIndex = (currentIndex + 1) % images.length;

    return new Response(JSON.stringify({ image: imageUrl }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'  // Always get fresh image
        }
    });
}

// Cache and fetch the full album
async function fetchFlickrImages(env) {
    const cache = caches.default;
    const cacheKey = `flickr-album-${env.FLICKR_ALBUM_ID}`;
    
    let response = await cache.match(cacheKey);
    if (response) {
        return await response.json();
    }

    const url = `https://www.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${env.FLICKR_API_KEY}&photoset_id=${env.FLICKR_ALBUM_ID}&user_id=${env.FLICKR_USER_ID}&format=json&nojsoncallback=1`;

    try {
        response = await fetch(url);
        const data = await response.json();

        const imageUrls = data.photoset.photo.map(photo =>
            `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`
        );

        // Cache the photoset for 24 hours
        response = new Response(JSON.stringify(imageUrls), {
            headers: { 'Content-Type': 'application/json' }
        });
        response.headers.append('Cache-Control', 'max-age=86400');
        cache.put(cacheKey, response.clone());

        return imageUrls;
    } catch (error) {
        console.error('Error fetching Flickr images:', error);
        return [env.FALLBACK_IMAGE];
    }
}

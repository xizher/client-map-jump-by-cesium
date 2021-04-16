import React, { useEffect } from 'react'
import {
  WebMap,
  MapEntities,
  MapCamera,
  Basemap,
  MapTools
} from '@xizher/cesium'
import { Color, Entity, Math as CesiumMath, Rectangle, ScreenSpaceEventHandler, ScreenSpaceEventType, Cartesian3, HeadingPitchRange } from 'cesium'
import { baseUtils } from '@xizher/js-utils'

function App () : JSX.Element {
  const divId = 'cesium-container'
  const webMap = new WebMap(divId, {
    baseUrl: '/cesium/v1.79.1/Build/Cesium/',
    debug: true })
    .use(new Basemap())
    .use(new MapEntities())
    .use(new MapCamera())
    .use(new MapTools())

  // 默认起始经纬度
  const [defaultLon, defaultLat] = [113.1805, 23.1205]

  /** 盒子高度 */
  const boxHeight = 50

  /** 跳跃物体Id */
  const jumpObject = baseUtils.createGuid()

  /** 初始速度 */
  const defualtSpeed = .0001

  /** 盒子边长的一半 */
  const boxWidthHalf = .0005

  // 盒子创建函数
  function createBox (lon: number, lat: number) : Entity {
    const id = baseUtils.createGuid()
    const [xmin, ymin] = [lon - boxWidthHalf, lat - boxWidthHalf]
    const [xmax, ymax] = [lon + boxWidthHalf, lat + boxWidthHalf]
    const entityOptions = {
      id,
      rectangle: {
        coordinates: Rectangle.fromDegrees(xmin, ymin, xmax, ymax),
        extrudedHeight: boxHeight,
        outline: true,
        outlineColor: Color.WHITE,
        outlineWidth: 4,
        stRotation: CesiumMath.toRadians(45),
        material: Color.fromRandom({ alpha: 1.0 }),
      }
    }
    webMap.mapEntities?.addEntities(entityOptions)
    const entity = webMap.entities.getById(id) as Entity
    return entity
  }

  // 创建随机距离
  function createDistance () : number {
    return baseUtils.createIntRandom(15, 45) / 10000
  }

  type JumpType = 'to-east' | 'to-north'

  /** 当前盒子Id和目标盒子Id */
  /* eslint-disable @typescript-eslint/indent */
  let sourceBox: Entity | null, sourceLon: number, sourceLat: number,
      targetBox: Entity, targetLon: number, targetLat: number,
      speed: number, type: JumpType
  /* eslint-enable @typescript-eslint/indent */

  function reset () {
    sourceBox = null
    webMap.mapEntities?.clearEntities()
    createNextJumpBox()
  }

  function createNextJumpBox () {
    if (!sourceBox) {
      [sourceLon, sourceLat] = [defaultLon, defaultLat]
      ;[targetLon, targetLat] = [defaultLon, defaultLat]
      sourceBox = createBox(sourceLon, sourceLat)
      targetBox = sourceBox
      webMap.mapEntities?.addEntities({
        id: jumpObject,
        position: Cartesian3.fromDegrees(sourceLon, sourceLat, boxHeight),
        point: {
          color: Color.BLACK,
          pixelSize: 28,
        }
      })
      createNextJumpBox()
      return
    }
    [sourceLon, sourceLat] = [targetLon, targetLat]
    type = baseUtils.createIntRandom(0, 1) === 0 ? 'to-east' : 'to-north'
    if (type === 'to-east') {
      [targetLon, targetLat] = [sourceLon + createDistance(), sourceLat]
    } else {
      [targetLon, targetLat] = [sourceLon, sourceLat + createDistance()]
    }
    sourceBox = targetBox
    targetBox = createBox(targetLon, targetLat)
    webMap.viewer.flyTo([sourceBox, targetBox], {
      duration: 1,
      offset: new HeadingPitchRange(
        CesiumMath.toRadians(type === 'to-east' ? 0 : -90),
        CesiumMath.toRadians(-45),
      )
    })

  }

  function initMouseEvent () {
    let handlerId: number
    const handler = new ScreenSpaceEventHandler(webMap.scene.canvas)
    handler.setInputAction(() => {
      speed = defualtSpeed
      handlerId = setInterval(() => {
        setSourceBoxHeight()
        speed += .000175
      }, 100)
    }, ScreenSpaceEventType.LEFT_DOWN)
    handler.setInputAction(() => {
      clearInterval(handlerId)
      jump().then(result => {
        if (result) {
          setSourceBoxHeight(boxHeight)
          createNextJumpBox()
        } else {
          reset()
        }
      })
    }, ScreenSpaceEventType.LEFT_UP)
  }

  function setSourceBoxHeight (height?: number) {
    const extrudedHeight = sourceBox?.rectangle?.extrudedHeight
    if (!extrudedHeight) {
      return
    }
    if (height) {
      // eslint-disable-next-line
      // @ts-ignore
      extrudedHeight.setValue(height)
    } else {
      // eslint-disable-next-line
      // @ts-ignore
      extrudedHeight.setValue(extrudedHeight.getValue() - 1)
    }
  }

  function jump () : Promise<boolean> {
    return new Promise((resolve) => {
      const start = type === 'to-east' ? sourceLon : sourceLat
      const trueEnd = type === 'to-east' ? targetLon : targetLat
      const end = start + speed
      const [x] = lonlatToWebMercator(start, 0)
      const [tx] = lonlatToWebMercator(end, 0)

      const r = Math.abs((tx - x)) / 2
      const center = x + r
      const a = center
      const b = boxHeight

      let tempValue = start

      const handler = setInterval(() => {
        tempValue += .00005

        if (tempValue >= end) {
          clearInterval(handler)
          if (Math.abs(trueEnd - end) < boxWidthHalf) {
            type === 'to-east'
              ? targetLon = end
              : targetLat = end
            resolve(true)
          } else {
            resolve(false)
          }
        }
        const tempHeight = Math.sqrt(r ** 2 - (lonlatToWebMercator(tempValue, 0)[0] - a) ** 2) + b
        const entity = webMap.entities.getById(jumpObject)
        entity && webMap.mapEntities?.removeEntities(entity)
        webMap.mapEntities?.addEntities({
          id: jumpObject,
          position: type === 'to-east'
            ? Cartesian3.fromDegrees(tempValue >= end ? end : tempValue, sourceLat, tempValue >= end ? 50 : tempHeight)
            : Cartesian3.fromDegrees(sourceLon, tempValue >= end ? end : tempValue, tempValue >= end ? 50 : tempHeight),
          point: {
            color: Color.BLACK,
            pixelSize: 28,
          }
        })
      }, 10)
    })
  }

  function lonlatToWebMercator (lon: number, lat: number) : [number, number] {
    const x = lon * 20037508.34 / 180
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180)
    y = y * 20037508.34 / 180
    return [x, y]
  }

  useEffect(() => {
    webMap.mount()
    createNextJumpBox()
    initMouseEvent()
  }, [])

  return (<>
    <div className="w-screen h-screen" id={ divId }></div>
  </>)
}

export default App
